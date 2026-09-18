# Realtime Location Monitor - Product Requirements Document

## Overview
- **Summary**: Aplikasi web monitoring lokasi device secara realtime dengan tampilan peta interaktif mirip Google Maps, dilengkapi pemantauan kecepatan gerak device dan sistem pairing kode sederhana.
- **Purpose**: Memungkinkan user memantau posisi geografis dan kecepatan beberapa device secara bersamaan dalam satu dashboard peta, dengan update lokasi secara live.
- **Target Users**: User yang ingin memantau pergerakan device (misal: tracking kendaraan, personil, aset) tanpa perlu sistem rumit.

## Goals
- Menampilkan peta interaktif full-screen dengan style mirip Google Maps
- Mendukung input banyak device via pairing code sederhana (KODE-1234)
- Update lokasi dan kecepatan device secara realtime (< 1 detik latency)
- Menampilkan indikator status koneksi device secara visual (badge pulse)
- Menyediakan halaman simulator device untuk mengirim data lokasi palsu (untuk testing tanpa GPS hardware)
- Menampilkan riwayat jejak pergerakan device (polyline) di peta

## Non-Goals
- Tidak menyimpan riwayat lokasi jangka panjang ke database
- Tidak memiliki sistem autentikasi user/login, cukup pairing code per device
- Tidak menyediakan rute/navigasi turn-by-turn
- Tidak support integrasi GPS hardware native (hanya via browser Geolocation API & simulator)
- Tidak ada mobile app native, hanya web responsive

## Background & Context
- User meminta antarmuka rapi dengan elemen terorganisir, badge status mencolok, label eksplisit, dan sistem pairing sederhana KODE-1234.
- Aplikasi dibangun dari nol di direktori kosong dengan tech stack web modern.

## Functional Requirements
- **FR-1**: User dapat membuka halaman Monitor yang menampilkan peta full-screen dengan kontrol zoom/pan seperti Google Maps.
- **FR-2**: User dapat memasukkan Pairing Code (format: `DEV-XXXX`) untuk mendaftarkan device baru ke dashboard.
- **FR-3**: Setiap device yang terhubung ditampilkan sebagai Marker di peta, lengkap dengan label nama device.
- **FR-4**: Lokasi device diperbarui secara realtime melalui WebSocket dengan frekuensi update ~1Hz.
- **FR-5**: Kecepatan gerak device (km/jam) ditampilkan di tooltip marker dan panel info.
- **FR-6**: Tersedia badge status koneksi (Connected/Pindah/Disconnected) dengan animasi pulse untuk status aktif.
- **FR-7**: Tersedia halaman Device Simulator yang mensimulasikan pergerakan device mengirim data lokasi + kecepatan via WebSocket.
- **FR-8**: Riwayat jejak (polyline) pergerakan device ditampilkan sebagai garis berwarna di peta.
- **FR-9**: Panel samping menampilkan daftar semua device beserta status, kecepatan, koordinat, dan waktu update terakhir.
- **FR-10**: User dapat menghapus/melepas device dari dashboard.

## Non-Functional Requirements
- **NFR-1**: Aplikasi berjalan di browser modern (Chrome/Firefox/Edge) tanpa build step kompleks.
- **NFR-2**: Latensi update lokasi dari pengirim ke tampilan monitor < 1 detik (realtime).
- **NFR-3**: UI responsive, dapat diakses dari HP dan desktop.
- **NFR-4**: Map tile diambil dari provider CDN gratis (OpenStreetMap) tanpa API key.
- **NFR-5**: Setup dapat dijalankan hanya dengan `npm install && npm start`.

## Constraints
- **Technical**: WebSocket untuk realtime, Leaflet.js untuk library peta, Node.js + Express backend vanilla (tidak ada framework frontend berat).
- **Business**: Tanpa biaya langganan API, semua dependency open source.
- **Dependencies**: Node.js versi terbaru, npm.

## Assumptions
- Device dan Monitor dapat terhubung ke server WebSocket yang sama.
- Untuk testing tanpa device GPS asli, simulator dapat digunakan untuk generate data lokasi acak.
- User menggunakan koneksi internet stabil untuk map tile loading.

## Acceptance Criteria

### AC-1: Halaman Monitor menampilkan peta full-screen interaktif
- **Type**: `rule`
- **Given**: Aplikasi server berjalan di localhost:3000
- **When**: User membuka `/` di browser
- **Then**: Terlihat peta full-screen dengan kontrol zoom (+/-), attribution OSM, dan panel samping daftar device
- **Pass Condition**: Peta ter-render tanpa error console; elemen zoom control terlihat; panel samping muncul
- **Evidence**: Screenshot halaman `/` + output console browser

### AC-2: Pairing code dapat mendaftarkan device ke monitor
- **Type**: `rule`
- **Given**: Halaman Monitor terbuka dan Device Simulator aktif dengan kode `DEV-1234`
- **When**: User mengetik `DEV-1234` di form input pairing dan klik "Tambah Device"
- **Then**: Marker dengan label `DEV-1234` muncul di peta dan device muncul di panel daftar dengan status badge "Connected"
- **Pass Condition**: Marker muncul di peta; entri `DEV-1234` ada di panel samping; status Connected dengan animasi pulse
- **Evidence**: Screenshot peta + panel, log WebSocket di server

### AC-3: Lokasi dan kecepatan device update realtime
- **Type**: `rule`
- **Given**: Device `DEV-1234` terdaftar di monitor dan simulator mengirim update lokasi bergerak
- **When**: Simulator mengirim update setiap ~1 detik
- **Then**: Posisi marker di peta bergeser, nilai kecepatan di panel berubah, dan waktu update terakhir refresh
- **Pass Condition**: Dalam 5 detik, setidaknya 3 perubahan posisi marker terlihat; kecepatan > 0 km/jam; timestamp update bertambah
- **Evidence**: Video/screenshot sequence, log WebSocket server

### AC-4: Riwayat jejak (polyline) tergambar di peta
- **Type**: `rule`
- **Given**: Device `DEV-1234` telah bergerak minimal 5 titik
- **When**: User melihat peta
- **Then**: Garis polyline berwarna menghubungkan titik-titik lokasi terakhir device
- **Pass Condition**: Polyline dengan panjang > 0 segment terlihat di peta mengikuti lintasan marker
- **Evidence**: Screenshot polyline, inspeksi DOM layer peta

### AC-5: Device dapat dilepas dari monitor
- **Type**: `rule`
- **Given**: Device `DEV-1234` terdaftar di panel
- **When**: User klik tombol "Hapus" di baris device pada panel
- **Then**: Marker hilang dari peta, device hilang dari panel daftar, dan polyline jejak juga hilang
- **Pass Condition**: Tidak ada marker / polyline `DEV-1234`; panel samping tidak menampilkan entri tersebut
- **Evidence**: Screenshot sebelum & sesudah, output console

### AC-6: Status badge koneksi dengan animasi pulse
- **Type**: `rubric`
- **Dimension**: Keterlihatan indikator status koneksi device
- **Scale**: 1-5
- **Anchors**: 1 = tidak ada status; 3 = ada badge statis; 5 = badge berwarna eksplisit + animasi pulse untuk Connected
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot panel daftar device + inspeksi CSS

### AC-7: Kualitas UI kerapian & organisasi panel
- **Type**: `rubric`
- **Dimension**: Kerapian layout dan label eksplisit pada dashboard
- **Scale**: 1-5
- **Anchors**: 1 = berantakan; 3 = lumayan terorganisir; 5 = panel tersusun jelas, semua label fungsional eksplisit (tidak ambigu)
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot full dashboard monitor

### AC-8: Halaman Device Simulator berfungsi mengirim data
- **Type**: `rule`
- **Given**: User membuka `/device`
- **When**: User isi Pairing Code `DEV-9999`, pilih mode simulasi (misal: "Jalan acak"), lalu klik "Mulai Simulasi"
- **Then**: Simulator menampilkan koordinat terkini, kecepatan, dan log data yang dikirim ke server; di monitor, device `DEV-9999` muncul jika sudah di-pair
- **Pass Condition**: Log simulator menampilkan "Sending update..." berulang; monitor terima data jika pair
- **Evidence**: Output log simulator, console server

### AC-9: Responsif di layar mobile (lebar < 768px)
- **Type**: `rule`
- **Given**: Browser diresize ke width 375px (iPhone SE)
- **When**: Membuka halaman monitor dan simulator
- **Then**: Tidak ada elemen terpotong horizontal; panel menyesuaikan; tombol dapat diklik
- **Pass Condition**: Tidak ada horizontal scroll; semua elemen terlihat dan interaktif
- **Evidence**: Screenshot mobile viewport

## Open Questions
- [x] Tech stack disetujui: Node.js + Express + Socket.io + Leaflet.js, frontend vanilla JS tanpa framework berat.
