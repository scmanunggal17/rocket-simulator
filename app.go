package main

import (
	"bufio"
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.bug.st/serial"
)

// App struct
type App struct {
	ctx      context.Context
	port     serial.Port
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
				runtime.EventsEmit(a.ctx, "serial:rate", count)
			}
		}
	}()
}

// ListSerialPorts returns available serial/COM ports on the system.
func (a *App) ListSerialPorts() ([]string, error) {
	ports, err := serial.GetPortsList()
	if err != nil {
		return nil, err
	}
	return ports, nil
}

// ConnectSerial opens a serial port at the given baud rate and starts reading CSV data.
func (a *App) ConnectSerial(portName string, baudRate int) error {
	if a.active.Load() {
		return nil
	}
	mode := &serial.Mode{
		BaudRate: baudRate,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}
	p, err := serial.Open(portName, mode)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", portName, err)
	}
	a.mu.Lock()
	a.port = p
	a.mu.Unlock()
	a.active.Store(true)
	runtime.EventsEmit(a.ctx, "serial:connected", true)
	go a.readLoop(p)
	return nil
}

// DisconnectSerial closes the serial port.
func (a *App) DisconnectSerial() {
	if !a.active.Load() {
		return
	}
	a.active.Store(false)
	a.mu.Lock()
	if a.port != nil {
		a.port.Close()
		a.port = nil
	}
	a.mu.Unlock()
	runtime.EventsEmit(a.ctx, "serial:connected", false)
}

func (a *App) readLoop(p serial.Port) {
	defer func() {
		if a.active.Swap(false) {
			a.mu.Lock()
			a.port = nil
			a.mu.Unlock()
			runtime.EventsEmit(a.ctx, "serial:connected", false)
		}
	}()
	scanner := bufio.NewScanner(p)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		a.parseLine(line)
	}
}

// parseLine parses a CSV line: altAbs,altRel,pitch,roll,yaw,lat,lon
func (a *App) parseLine(line string) {
	fields := strings.Split(line, ",")
	if len(fields) < 7 {
		return
	}
	altAbs, err0 := strconv.ParseFloat(strings.TrimSpace(fields[0]), 64)
	altRel, err1 := strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
	pitchVal, err2 := strconv.ParseFloat(strings.TrimSpace(fields[2]), 64)
	rollVal, err3 := strconv.ParseFloat(strings.TrimSpace(fields[3]), 64)
	yawVal, err4 := strconv.ParseFloat(strings.TrimSpace(fields[4]), 64)
	lat, err5 := strconv.ParseFloat(strings.TrimSpace(fields[5]), 64)
	lon, err6 := strconv.ParseFloat(strings.TrimSpace(fields[6]), 64)

	if err0 != nil || err1 != nil || err2 != nil || err3 != nil ||
		err4 != nil || err5 != nil || err6 != nil {
		return
	}

	runtime.EventsEmit(a.ctx, "serial:data", map[string]any{
		"altitudeAbs": altAbs,
		"altitudeRel": altRel,
		"pitch":       pitchVal,
		"roll":        rollVal,
		"yaw":         yawVal,
		"lat":         lat,
		"lon":         lon,
	})

	a.mu.Lock()
	a.msgCount++
	a.mu.Unlock()
}
