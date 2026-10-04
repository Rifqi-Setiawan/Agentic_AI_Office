# Rekonsiliasi persetujuan visual G0

Instruksi pengguna pada kartu t_2ee8a528 menyatakan “User ACC-all remains valid historical approval”. Karena itu, “PENDING HUMAN SIGN-OFF” di laporan G0 adalah status historis, bukan kebutuhan persetujuan baru. Laporan asli dan kriterianya tetap disimpan.

ACC-all tidak dengan sendirinya mengikat hash PNG tertentu sebagai baseline regresi. PNG baseline di working tree sudah dimodifikasi sebelum run ini; tes sebelumnya menimpanya. Run ini menyimpan hash PNG working tree dan versi Git secara terpisah, tanpa mengubah keduanya. Sampai provenance baseline yang disetujui dapat dibuktikan, perbandingan terhadap PNG tersimpan adalah pemeriksaan regresi teknis, bukan bukti persetujuan visual baru. Perbedaan tidak boleh disembunyikan dengan memperbarui baseline.
