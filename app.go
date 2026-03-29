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
	tcpConn  net.Conn // TCP connection to the ESP32
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

// StartMavlink dials a TCP connection to the ESP32 at addr (e.g. "192.168.4.1:5760").
// Returns an error immediately if the ESP32 is unreachable — no false "connected" state.
func (a *App) StartMavlink(addr string) error {
	if a.active.Load() {
		return nil
	}
	conn, err := net.DialTimeout("tcp4", addr, 5*time.Second)
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.tcpConn = conn
	a.mu.Unlock()
	a.active.Store(true)
	runtime.EventsEmit(a.ctx, "mavlink:connected", true)
	go a.readLoop(conn)
	return nil
}

// StopMavlink closes the TCP connection. Called from the frontend on Disconnect.
func (a *App) StopMavlink() {
	if !a.active.Load() {
		return
	}
	a.active.Store(false)
	a.mu.Lock()
	if a.tcpConn != nil {
		a.tcpConn.Close()
		a.tcpConn = nil
	}
	a.mu.Unlock()
	runtime.EventsEmit(a.ctx, "mavlink:connected", false)
}

// sendCommandLong builds and sends a MAVLink v1 COMMAND_LONG (#76) packet.
// CRC_EXTRA for COMMAND_LONG = 152.
func (a *App) sendCommandLong(cmd uint16, param1 float32) error {
	a.mu.Lock()
	conn := a.tcpConn
	a.mu.Unlock()
	if conn == nil {
		return nil // not connected, silently ignore
	}

	// COMMAND_LONG payload layout (33 bytes)
	var p [33]byte
	mathFloat32ToLE(p[0:], param1) // param1
	// param2..7 = 0
	p[28] = 1 // target_system
	p[29] = 1 // target_component
	p[30] = uint8(cmd)
	p[31] = uint8(cmd >> 8)
	p[32] = 0 // confirmation

	frame := buildMAVLinkFrame(76, 152, p[:])
	_, err := conn.Write(frame)
	return err
}

func mathFloat32ToLE(b []byte, v float32) {
	u := math.Float32bits(v)
	binary.LittleEndian.PutUint32(b, u)
}

func buildMAVLinkFrame(msgID uint8, crcExtra uint8, payload []byte) []byte {
	plen := len(payload)
	frame := make([]byte, 8+plen)
	frame[0] = 0xFE
	frame[1] = uint8(plen)
	frame[2] = 0   // seq (GCS → vehicle, seq not critical)
	frame[3] = 255 // sys_id = GCS
	frame[4] = 1
	frame[5] = msgID
	copy(frame[6:], payload)

	crc := uint16(0xFFFF)
	for i := 1; i < 6+plen; i++ {
		crcAccumulate(frame[i], &crc)
	}
	crcAccumulate(crcExtra, &crc)
	frame[6+plen] = uint8(crc)
	frame[6+plen+1] = uint8(crc >> 8)
	return frame
}

func crcAccumulate(b uint8, crc *uint16) {
	tmp := b ^ uint8(*crc&0xFF)
	tmp ^= tmp << 4
	*crc = (*crc >> 8) ^ (uint16(tmp) << 8) ^ (uint16(tmp) << 3) ^ (uint16(tmp) >> 4)
}

// ArmRocket sends MAV_CMD_COMPONENT_ARM_DISARM (400, param1=1) — safety arm.
func (a *App) ArmRocket() error {
	return a.sendCommandLong(400, 1.0)
}

// DisarmRocket sends MAV_CMD_COMPONENT_ARM_DISARM (400, param1=0) — safety disarm.
func (a *App) DisarmRocket() error {
	return a.sendCommandLong(400, 0.0)
}

// LaunchRocket sends MAV_CMD_MISSION_START (300) to trigger flight after arming.
func (a *App) LaunchRocket() error {
	return a.sendCommandLong(300, 0.0)
}

// AbortRocket sends MAV_CMD_DO_FLIGHTTERMINATION (185) with param1=1 to abort.
func (a *App) AbortRocket() error {
	return a.sendCommandLong(185, 1.0)
}

func (a *App) readLoop(conn net.Conn) {
	defer func() {
		// Notify the frontend if the connection dropped unexpectedly
		// (ESP32 powered off, walked out of WiFi range, etc.)
		if a.active.Swap(false) {
			a.mu.Lock()
			a.tcpConn = nil
			a.mu.Unlock()
			runtime.EventsEmit(a.ctx, "mavlink:connected", false)
		}
	}()
	buf := make([]byte, 2048)
	for {
		n, err := conn.Read(buf)
		if n > 0 {
			a.parseFrames(buf[:n])
		}
		if err != nil {
			break
		}
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

	case 33: // GLOBAL_POSITION_INT — lat/lon in 1e-7 deg, alt in mm, vz cm/s, hdg cdeg
		if len(p) < 28 {
			return
		}
		lat := float64(int32(binary.LittleEndian.Uint32(p[4:]))) / 1e7
		lon := float64(int32(binary.LittleEndian.Uint32(p[8:]))) / 1e7
		relAlt := float64(int32(binary.LittleEndian.Uint32(p[16:]))) / 1000.0
		vz := float64(int16(binary.LittleEndian.Uint16(p[24:]))) / 100.0
		hdg := float64(binary.LittleEndian.Uint16(p[26:])) / 100.0
		runtime.EventsEmit(a.ctx, "mavlink:position", map[string]any{
			"lat":      lat,
			"lon":      lon,
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
			"rssi":  int(p[0]),
			"noise": int(p[3]),
		})
	}
}
