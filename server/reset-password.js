// server/reset-password.js
const bcrypt = require('bcrypt'); // atau 'bcryptjs'
// Import koneksi database Anda (contoh: mongoose, mysql2, prisma, dll)
// const db = require('./db'); 

async function resetPassword(username, newPassword) {
  try {
    // 1. Hash password baru
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 2. Update ke database (Sesuaikan query dengan DB Anda)
    // Contoh MySQL:
    // await db.query('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);

    // Contoh MongoDB / Mongoose:
    // await User.updateOne({ username }, { password: hashedPassword });

    console.log(`Password untuk user '${username}' berhasil diubah!`);
  } catch (error) {
    console.error('Gagal mereset password:', error);
  }
}

// Jalankan fungsi (ganti username & password sesuai kebutuhan)
resetPassword('admin', 'passwordBaru123');
