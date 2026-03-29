package main

import (
	"context"
	"encoding/binary"
	"math"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	udpConn  *net.UDPConn
	active   atomic.Bool
	mu       sync.Mutex
	msgCount int
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Emit message rate to frontend every second
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if a.active.Load() {
				a.mu.Lock()
				count := a.msgCount
				a.msgCount = 0
				a.mu.Unlock()
				runtime.EventsEmit(a.ctx, "mavlink:rate", count)
			}
		}
	}()
}

// StartMavlink opens a UDP listener on the given port and starts receiving
// MAVLink v1 packets. Called from the frontend when the user clicks Connect.
func (a *App) StartMavlink(port int) error {
	if a.active.Load() {
		return nil
	}
	addr := &net.UDPAddr{Port: port, IP: net.IPv4zero}
	conn, err := net.ListenUDP("udp4", addr)
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.udpConn = conn
	a.mu.Unlock()
	a.active.Store(true)
	runtime.EventsEmit(a.ctx, "mavlink:connected", true)
	go a.readLoop(conn)
	return nil
}

// StopMavlink closes the UDP listener. Called from the frontend on Disconnect.
func (a *App) StopMavlink() {
	if !a.active.Load() {
		return
	}
	a.active.Store(false)
	a.mu.Lock()
	if a.udpConn != nil {
		a.udpConn.Close()
		a.udpConn = nil
	}
	a.mu.Unlock()
	runtime.EventsEmit(a.ctx, "mavlink:connected", false)
}

func (a *App) readLoop(conn *net.UDPConn) {
	buf := make([]byte, 2048)
	for a.active.Load() {
		n, _, err := conn.ReadFromUDP(buf)
		if err != nil {
			break
		}
		a.parseFrames(buf[:n])
	}
}

// parseFrames walks through a UDP payload and dispatches each MAVLink v1 frame.
func (a *App) parseFrames(data []byte) {
	for i := 0; i < len(data); {
		if data[i] != 0xFE { // MAVLink v1 STX
			i++
			continue
		}
		if i+6 > len(data) {
			break
		}
		payLen := int(data[i+1])
		frameLen := 8 + payLen // STX+LEN+SEQ+SYS+COMP+MSGID + payload + CRC(2)
		if i+frameLen > len(data) {
			break
		}
		msgID := data[i+5]
		payload := data[i+6 : i+6+payLen]
		a.dispatch(msgID, payload)
		a.mu.Lock()
		a.msgCount++
		a.mu.Unlock()
		i += frameLen
	}
}

const r2d = 180.0 / math.Pi

func (a *App) dispatch(msgID uint8, p []byte) {
	switch msgID {

	case 0: // HEARTBEAT — just signal alive
		runtime.EventsEmit(a.ctx, "mavlink:heartbeat", true)

	case 26: // SCALED_IMU — xacc/yacc/zacc in mG, gyro in mrad/s, mag in mGauss
		if len(p) < 22 {
			return
		}
		const mG2ms2 = 9.80665 / 1000.0
		const mrad2deg = r2d / 1000.0
		runtime.EventsEmit(a.ctx, "mavlink:imu", map[string]any{
			"accX":  float64(int16(binary.LittleEndian.Uint16(p[4:]))) * mG2ms2,
			"accY":  float64(int16(binary.LittleEndian.Uint16(p[6:]))) * mG2ms2,
			"accZ":  float64(int16(binary.LittleEndian.Uint16(p[8:]))) * mG2ms2,
			"gyroX": float64(int16(binary.LittleEndian.Uint16(p[10:]))) * mrad2deg,
			"gyroY": float64(int16(binary.LittleEndian.Uint16(p[12:]))) * mrad2deg,
			"gyroZ": float64(int16(binary.LittleEndian.Uint16(p[14:]))) * mrad2deg,
			"magX":  float64(int16(binary.LittleEndian.Uint16(p[16:]))),
			"magY":  float64(int16(binary.LittleEndian.Uint16(p[18:]))),
			"magZ":  float64(int16(binary.LittleEndian.Uint16(p[20:]))),
		})

	case 30: // ATTITUDE — roll/pitch/yaw and rates in radians
		if len(p) < 28 {
			return
		}
		f := func(off int) float64 {
			return float64(math.Float32frombits(binary.LittleEndian.Uint32(p[off:])))
		}
		runtime.EventsEmit(a.ctx, "mavlink:attitude", map[string]any{
			"roll":      f(4) * r2d,
			"pitch":     f(8) * r2d,
			"yaw":       f(12) * r2d,
			"rollRate":  f(16) * r2d,
			"pitchRate": f(20) * r2d,
			"yawRate":   f(24) * r2d,
		})

	case 33: // GLOBAL_POSITION_INT — relative_alt in mm, vz in cm/s, hdg in cdeg
		if len(p) < 28 {
			return
		}
		relAlt := float64(int32(binary.LittleEndian.Uint32(p[16:]))) / 1000.0
		vz := float64(int16(binary.LittleEndian.Uint16(p[24:]))) / 100.0
		hdg := float64(binary.LittleEndian.Uint16(p[26:])) / 100.0
		runtime.EventsEmit(a.ctx, "mavlink:position", map[string]any{
			"altitude": relAlt,
			"vz":       -vz, // NED → standard (up positive)
			"heading":  hdg,
		})

	case 74: // VFR_HUD — airspeed, alt, climb in SI units
		if len(p) < 20 {
			return
		}
		f := func(off int) float64 {
			return float64(math.Float32frombits(binary.LittleEndian.Uint32(p[off:])))
		}
		runtime.EventsEmit(a.ctx, "mavlink:vfr", map[string]any{
			"speed":         f(0),
			"altitude":      f(8),
			"verticalSpeed": f(12),
		})

	case 109: // RADIO_STATUS — rssi/remrssi/noise as raw 0-254 values
		if len(p) < 9 {
			return
		}
		runtime.EventsEmit(a.ctx, "mavlink:radio", map[string]any{
			"rssi":    int(p[0]),
			"remRssi": int(p[1]),
			"noise":   int(p[3]),
		})
	}
}
