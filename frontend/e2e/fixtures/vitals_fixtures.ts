import type { HostVitals } from '../../src/types/office';

/**
 * Fixture pengujian telemetri Vitals untuk F23 / T2.4
 * Sesuai spesifikasi Dokumen 04 (04-environment-room-spec.md):
 * - CPU: > 80% selama 60 dtk -> LED rak server berkedip cepat, kipas AC berputar, Bastion berkeringat
 * - RAM: > 85% -> Rak server menyala oranye, Vector mondar-mandir
 * - Disk: > 85% -> Kardus mulai menumpuk di Data Center
 */
export const VITALS_FIXTURES = {
  // Kondisi Normal / Baseline: Seluruh metrik berada di bawah ambang batas
  normal: {
    cpu_percent: 24.5,
    memory_percent: 42.0,
    disk_percent: 55.0,
    status: 'healthy',
  } as HostVitals,

  // Ambang CPU: > 80% (diuji sebelum dan sesudah durasi 60 detik)
  cpuHigh: {
    cpu_percent: 88.5,
    memory_percent: 45.0,
    disk_percent: 55.0,
    status: 'warning',
  } as HostVitals,

  // Ambang RAM: > 85%
  ramHigh: {
    cpu_percent: 32.0,
    memory_percent: 91.5,
    disk_percent: 55.0,
    status: 'warning',
  } as HostVitals,

  // Ambang Disk: > 85%
  diskHigh: {
    cpu_percent: 28.0,
    memory_percent: 48.0,
    disk_percent: 89.4,
    status: 'warning',
  } as HostVitals,

  // Seluruh ambang aktif bersamaan (Kondisi beban puncak / kritis)
  allHigh: {
    cpu_percent: 94.0,
    memory_percent: 96.0,
    disk_percent: 92.5,
    status: 'critical',
  } as HostVitals,

  // Pemulihan kembali ke kondisi normal
  recovery: {
    cpu_percent: 19.5,
    memory_percent: 39.0,
    disk_percent: 50.0,
    status: 'healthy',
  } as HostVitals,
};
