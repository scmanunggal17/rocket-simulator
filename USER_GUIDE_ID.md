# Rocket GCS — Panduan Pengguna

Rocket GCS adalah aplikasi desktop ground control station untuk memantau dan mensimulasikan penerbangan roket. Aplikasi ini mendukung dua mode: mode **Simulasi** bawaan untuk pengujian dan pelatihan, serta mode **Kontroler** untuk membaca data langsung dari flight controller yang terhubung melalui serial.

---

## Tata Letak Aplikasi

```
┌──────────────────────────────────────────────────────────┐
│  HEADER — judul · fase · luncur/batalkan · koneksi serial │
├──────────────────────────────────────────────────────────┤
│  PANEL ATAS — telemetri penerbangan langsung (3 grup)    │
├────────────────────────────────┬─────────────────────────┤
│                                │                         │
│  JENDELA UTAMA (bertab)        │  PANEL SAMPING          │
│  · SIMULASI                    │  · Indikator Attitude   │
│  · LINTASAN                    │  · Indikator Kompas     │
│  · PUTAR ULANG LOG             │  · Sensor IMU Mentah    │
│  · PETA                        │                         │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

Panel samping dapat diubah ukurannya dengan menyeret pembatas antara jendela utama dan panel samping.

---

## Cara Kerja Penerbangan (Langkah demi Langkah)

1. Pilih **Sumber Data** di tab SIMULASI: **SIMULASI** atau **KONTROLER**.
2. Isi **Nilai Awal** dan **Spesifikasi Roket**.
3. Tekan **✓ KONFIRMASI**. Fase berganti menjadi **SIAP**.
4. Tekan **▲ LUNCUR** di header. Hitung mundur dimulai.
5. Saat hitung mundur mencapai nol, roket diluncurkan melalui fase penerbangan:
   **BOOST → COAST → APOGEE → DESCENT → LANDED**
6. Saat roket mendarat, log penerbangan otomatis disimpan.
7. Tekan **↺ RESET** untuk kembali ke STANDBY dan memulai misi baru.

---

## Bilah Header

| Elemen | Keterangan |
|---|---|
| **Rocket GCS** | Judul aplikasi |
| **Lencana Fase** | Menampilkan fase penerbangan saat ini (lihat Fase Penerbangan di bawah) |
| **▲ LUNCUR** | Memulai hitung mundur dan meluncurkan roket. Hanya tersedia saat fase SIAP |
| **T–N** | Tampilan hitung mundur (ditampilkan selama fase COUNTDOWN) |
| **■ BATALKAN** | Membatalkan penerbangan di tengah misi. Semua telemetri dibekukan |
| **↺ RESET** | Mengembalikan semua ke STANDBY setelah penerbangan selesai atau dibatalkan |
| **RATE** | Throughput telemetri — berapa banyak pesan data per detik yang diproses |
| **Port Serial** | Dropdown untuk memilih port serial/COM untuk koneksi kontroler |
| **⟳** | Segarkan daftar port serial yang tersedia |
| **HUBUNG / PUTUS** | Buka atau tutup koneksi serial ke flight controller |

---

## Fase Penerbangan

Penerbangan berlangsung melalui fase-fase berikut secara berurutan:

| Fase | Warna | Keterangan |
|---|---|---|
| **STANDBY** | Abu-abu | Menunggu pengguna mengonfigurasi dan mengonfirmasi parameter |
| **READY** | Biru | Konfigurasi dikonfirmasi. Siap diluncurkan |
| **COUNTDOWN** | Kuning | Menghitung mundur menuju pengapian. Durasinya diatur oleh parameter Waktu Hitung Mundur |
| **BOOST** | Oranye | Motor menyala. Gaya dorong mendorong roket ke atas. Bahan bakar dikonsumsi |
| **COAST** | Biru | Motor telah habis terbakar (bahan bakar habis). Roket masih melaju ke atas karena momentum namun melambat akibat gravitasi |
| **APOGEE** | Ungu | Roket telah mencapai titik tertingginya. Kecepatan vertikal mendekati nol |
| **DESCENT** | Oranye | Roket jatuh kembali ke bawah akibat gravitasi |
| **LANDED** | Hijau | Roket telah mendarat. Log penerbangan otomatis disimpan |
| **ABORTED** | Merah | Penerbangan dibatalkan secara manual oleh pengguna |

---

## Panel Atas — Telemetri Langsung

Selalu terlihat di bawah header. Menampilkan nilai real-time dalam tiga grup.

### PENERBANGAN

| Label | Satuan | Yang Ditampilkan | Cara Perhitungan |
|---|---|---|---|
| **DURASI** | mm:ss | Waktu sejak motor dinyalakan | Timer dimulai saat BOOST dan bertambah setiap 0,1 detik |
| **KECEPATAN** | m/s | Kecepatan total roket | √(kecepatan_horizontal² + kecepatan_vertikal²) |
| **K-VERTIKAL** | m/s | Kecepatan vertikal (naik/turun) | Laju perubahan ketinggian. Positif = naik, negatif = turun |
| **AKSELERASI** | m/s² | Akselerasi saat ini | Saat BOOST: gaya_dorong ÷ massa_kering. Setelah habis: gravitasi (≈ 9,81 m/s²) menarik roket ke bawah |

### KETINGGIAN

| Label | Satuan | Yang Ditampilkan | Cara Perhitungan |
|---|---|---|---|
| **SEKARANG** | m | Ketinggian di atas titik peluncuran (AGL) | Dimulai dari nilai Ketinggian Relatif dan berubah berdasarkan kecepatan vertikal × waktu |
| **MAKS** | m | Ketinggian tertinggi yang dicapai sejauh ini | Melacak puncak ketinggian SEKARANG sepanjang penerbangan |
| **JARAK** | km | Jarak horizontal dari landasan peluncuran | Akumulasi kecepatan horizontal × waktu, dikonversi ke kilometer |
| **ETA APOGEE** | s | Detik hingga roket mencapai puncaknya | kecepatan_vertikal ÷ gravitasi (9,81). Menampilkan 0 setelah apogee tercapai |

### PROPULSI

| Label | Satuan | Yang Ditampilkan | Cara Perhitungan |
|---|---|---|---|
| **BBM TERPAKAI** | kg | Berapa banyak bahan bakar yang telah terbakar | waktu_berlalu × laju_bakar_bahan_bakar, dibatasi oleh Massa Bahan Bakar |
| **SISA** | kg | Bahan bakar yang tersisa di roket | Massa BBM − BBM Terpakai. Berubah warna: biru (normal), kuning (<30%), merah (<15%) |
| **KAPASITAS** | % | Indikator bahan bakar | (Sisa ÷ Massa BBM) × 100 |

> Laju bakar bahan bakar = Massa BBM ÷ Waktu Bakar (kg/s). Contoh: 3 kg BBM ÷ 5 s waktu bakar = 0,6 kg/s.

---

## Jendela Utama — Tab

### Tab SIMULASI

Di sinilah Anda menyiapkan dan mengonfigurasi penerbangan.

#### Sumber Data

Beralih antara dua mode:

| Mode | Keterangan |
|---|---|
| **SIMULASI** | Aplikasi menghasilkan semua data penerbangan menggunakan perhitungan fisika. Tidak memerlukan perangkat keras |
| **KONTROLER** | Aplikasi membaca data ketinggian, attitude, dan GPS dari flight controller yang terhubung via serial. Anda tetap harus memasukkan spesifikasi roket secara manual |

#### Nilai Awal (Hanya Mode Simulasi)

Ini mengatur kondisi awal penerbangan yang disimulasikan.

| Parameter | Satuan | Default | Keterangan |
|---|---|---|---|
| **Ketinggian Absolut** | m ASL | 100 | Ketinggian awal di atas permukaan laut. Ini adalah elevasi dunia nyata dari lokasi peluncuranmu |
| **Ketinggian Relatif** | m AGL | 0 | Ketinggian awal di atas permukaan tanah. Biasanya 0 (meluncur dari tanah) |
| **Pitch** | derajat | 45 | Sudut peluncuran dari horizontal. 90° = lurus ke atas, 0° = horizontal. Menentukan seberapa besar gaya dorong ke atas vs ke depan |
| **Roll** | derajat | 0 | Rotasi roll awal. 0° = datar. Roket akan sedikit berosilasi di sekitar nilai ini selama penerbangan |
| **Yaw** | derajat | 0 | Arah kompas dari arah peluncuran (0° = Utara, 90° = Timur, 180° = Selatan, 270° = Barat) |
| **Lintang** | derajat | −7,800000 | Lintang GPS dari lokasi peluncuran |
| **Bujur** | derajat | 110,370000 | Bujur GPS dari lokasi peluncuran |

#### Spesifikasi Roket

Ini mendefinisikan sifat fisik roketmu. Tersedia di mode Simulasi maupun Kontroler.

| Parameter | Satuan | Default | Keterangan |
|---|---|---|---|
| **Massa Kering** | kg | 10 | Berat roket tanpa bahan bakar. Digunakan untuk menghitung akselerasi: akselerasi = gaya_dorong ÷ massa_kering |
| **Gaya Dorong** | N | 1000 | Gaya yang dihasilkan motor dalam Newton. Gaya dorong lebih besar = akselerasi lebih cepat |
| **Waktu Bakar** | s | 5 | Berapa lama motor menyala. Setelah waktu ini, bahan bakar habis dan roket melaju dengan momentum |
| **Massa BBM** | kg | 3 | Total berat propelan. Digunakan untuk melacak konsumsi bahan bakar dan persentase sisa |
| **Tipe Nosel** | — | Conical | Bentuk nosel roket. Memilih preset akan mengisi otomatis Efisiensi Dorong dan Massa Nosel. Pilihan: **Conical** (93%, 0,5 kg), **Bell / de Laval** (97%, 0,7 kg), **Aerospike** (99%, 1,0 kg), **Custom** (ditentukan pengguna) |
| **Efisiensi Dorong** | 0–1 | 0,93 | Fraksi gaya dorong yang benar-benar dihasilkan nosel. Hanya dapat diedit jika Tipe Nosel adalah Custom. Gaya dorong efektif = Gaya Dorong × Efisiensi Dorong |
| **Massa Nosel** | kg | 0,5 | Berat komponen nosel. Ditambahkan ke Massa Kering saat menghitung akselerasi. Hanya dapat diedit jika Tipe Nosel adalah Custom |
| **Waktu Hitung Mundur** | s | 10 | Berapa detik hitung mundur sebelum pengapian setelah menekan LUNCUR |

#### Cara Simulasi Menghitung Penerbangan

1. **Fase BOOST**: Motor memberikan gaya dorong konstan yang dikurangi oleh efisiensi nosel. Massa nosel ditambahkan ke massa kering saat menghitung akselerasi. Akselerasi ini dibagi menjadi komponen vertikal dan horizontal berdasarkan sudut pitch.
   - Gaya dorong efektif = Gaya Dorong × Efisiensi Dorong
   - Total massa kering = Massa Kering + Massa Nosel
   - Akselerasi vertikal = sin(pitch) × (gaya_dorong_efektif ÷ total_massa_kering) − gravitasi
   - Akselerasi horizontal = cos(pitch) × (gaya_dorong_efektif ÷ total_massa_kering)

2. **Fase COAST**: Motor berhenti. Hanya gravitasi yang bekerja pada roket (menarik ke bawah sebesar 9,81 m/s²). Kecepatan horizontal sedikit berkurang akibat hambatan udara.

3. **APOGEE**: Saat kecepatan vertikal melewati nol — roket berhenti naik dan mulai jatuh.

4. **DESCENT**: Gravitasi menarik roket kembali ke bawah. Kecepatan vertikal menjadi semakin negatif.

5. **LANDED**: Ketinggian kembali ke ketinggian relatif awal. Semua kecepatan menjadi nol.

> **Pitch sangat berpengaruh.** Pitch 90° mengirimkan semua gaya dorong lurus ke atas (ketinggian maksimum, tanpa jarak horizontal). Pitch 45° membagi gaya dorong sama rata antara ketinggian dan jarak. Sudut lebih rendah memberikan jarak horizontal lebih jauh tetapi ketinggian lebih rendah.

#### Konfirmasi & Peluncuran

| Tombol | Kapan Tersedia | Yang Dilakukan |
|---|---|---|
| **✓ KONFIRMASI** | Fase STANDBY | Mengunci parameter dan berpindah ke fase SIAP |
| **EDIT** | Fase SIAP | Membuka kunci parameter agar dapat diubah |
| **▲ LUNCUR** | Fase SIAP (di header) | Memulai hitung mundur, lalu meluncur |

---

### Tab LINTASAN

Menampilkan dua visualisasi real-time selama penerbangan:

#### Tampilan Attitude (kiri)

Siluet roket 3D yang berputar untuk menunjukkan orientasi roket saat ini.

| Tampilan | Keterangan |
|---|---|
| **Badan roket** | Menunjuk ke arah terbang roket. Condong berdasarkan pitch |
| **Cincin roll** | Busur kecil di sekitar badan yang menunjukkan rotasi roll |
| **Nyala mesin** | Api oranye ditampilkan hanya selama fase BOOST |
| **Pembacaan P / R / Y** | Sudut pitch, roll, dan yaw saat ini dalam derajat |

#### Grafik Lintasan (kanan)

Grafik ketinggian-terhadap-waktu yang tergambar secara real-time saat roket terbang.

| Elemen | Keterangan |
|---|---|
| **Sumbu Y** | Ketinggian dalam meter |
| **Sumbu X** | Waktu misi dalam detik |
| **Warna garis** | Berubah berdasarkan fase penerbangan — oranye (naik), ungu (apogee), biru (turun), hijau (darat) |
| **Titik putih** | Posisi saat ini pada lintasan |
| **Pembacaan langsung** | Menampilkan ketinggian saat ini, kecepatan vertikal, dan ketinggian maksimum di bagian atas |

---

### Tab PUTAR ULANG LOG

Buka log penerbangan yang telah disimpan sebelumnya dan lihat data lintasan tanpa menjalankan simulasi baru.

#### Cara Menggunakan

1. Klik **⏏ BUKA FILE LOG**.
2. Pemilih file akan muncul. Navigasi ke `~/Documents/rocket-simulator/logs/` dan pilih file `.json`.
3. Grafik lintasan dan semua data penerbangan akan ditampilkan.

#### Yang Ditampilkan

| Bagian | Isi |
|---|---|
| **Grafik Lintasan** | Grafik ketinggian-terhadap-waktu yang sama seperti tab LINTASAN, digambar dari data yang disimpan. Termasuk garis penanda fase yang menunjukkan kapan setiap transisi fase terjadi |
| **Ringkasan** | Ketinggian maks, kecepatan vertikal maks, durasi penerbangan, jarak horizontal |
| **Fase** | Setiap transisi fase beserta timestamp-nya (mis., BOOST pada T+0,0d, COAST pada T+5,0d) |
| **Konfigurasi** | Semua parameter yang digunakan untuk penerbangan tersebut (ketinggian, pitch, massa, gaya dorong, dll.) |

> File log berformat JSON dan disimpan ke: `~/Documents/rocket-simulator/logs/flight_YYYYMMDD_HHMMSS.json`

---

### Tab PETA

Menampilkan posisi GPS roket pada peta. Posisi diperbarui secara real-time selama penerbangan menggunakan koordinat lokasi peluncuran dan jarak horizontal roket yang diproyeksikan sepanjang arah yaw.

---

## Panel Samping — IMU & Attitude

Panel kanan menampilkan data pengukuran inersia. Selalu terlihat terlepas dari tab mana yang aktif.

### Indikator Attitude

Instrumen cakrawala buatan yang menampilkan:
- **Pitch**: Seberapa jauh hidung condong ke atas atau ke bawah dari horizontal
- **Roll**: Seberapa jauh roket miring ke samping

### Indikator Kompas

Tampilan arah yang menampilkan:
- **Yaw**: Arah kompas saat ini (0–360°)
- **Laju yaw**: Seberapa cepat arah berubah

### Sensor Mentah

Tiga kartu sensor yang menampilkan nilai sumbu X / Y / Z dengan grafik batang:

| Sensor | Satuan | Yang Diukur |
|---|---|---|
| **Akselerometer** | m/s² | Akselerasi linier pada setiap sumbu. Selama BOOST menampilkan gaya dorong; dalam penerbangan bebas menampilkan gravitasi |
| **Giroskop** | derajat/s | Seberapa cepat roket berputar di sekitar setiap sumbu |
| **Magnetometer** | mGauss | Kekuatan medan magnet bumi, digunakan untuk menentukan arah kompas |

Warna batang menunjukkan intensitas: hijau (normal), kuning (peringatan), merah (kritis).

---

## Log Penerbangan (Simpan Otomatis)

Setiap penerbangan yang selesai secara otomatis disimpan saat roket mendarat (fase LANDED). Tidak diperlukan tindakan dari pengguna.

### Yang Disimpan

| Bagian | Data |
|---|---|
| **Meta** | ID penerbangan (berdasarkan tanggal/waktu), tanggal, sumber data (simulasi atau kontroler) |
| **Konfigurasi** | Semua nilai awal dan spesifikasi roket yang digunakan untuk penerbangan |
| **Peristiwa** | Setiap transisi fase beserta timestamp-nya |
| **Ringkasan** | Ketinggian maks, kecepatan vertikal maks, total durasi penerbangan, jarak horizontal |
| **Telemetri** | Deret waktu lengkap dari ketinggian dan kecepatan vertikal, diambil sampel ~10 kali per detik |

### Lokasi File

```
~/Documents/rocket-simulator/logs/flight_YYYYMMDD_HHMMSS.json
```

Contoh: `flight_20260405_143022.json`

File-file ini dapat dibuka nanti menggunakan tab **PUTAR ULANG LOG**.

---

## Menghubungkan Kontroler Serial

1. Colokkan flight controller ke komputer melalui USB.
2. Klik tombol **⟳** di samping dropdown port untuk menyegarkan port yang tersedia.
3. Pilih port yang benar dari dropdown (mis., `/dev/tty.usbserial-XXX` di Mac).
4. Klik **HUBUNG**. Indikator status berubah menjadi hijau saat terhubung.
5. Beralih sumber data ke **KONTROLER** di tab SIMULASI.
6. Masukkan **Spesifikasi Roket** dan tekan **✓ KONFIRMASI**.
7. Tekan **▲ LUNCUR** saat siap.

Kontroler harus mengirim data CSV melalui serial dalam format ini:
```
altitudeAbs, altitudeRel, pitch, roll, yaw, latitude, longitude
```

Baud rate default: **115200**.
