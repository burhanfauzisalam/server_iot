const mysql = require("mysql2");
require("dotenv").config();

// Membuat pool koneksi
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true, // Tunggu jika koneksi penuh
  connectionLimit: 10, // Batasi jumlah koneksi sekaligus
  queueLimit: 0, // Tidak ada batas antrian
});

// Membuat promise pool untuk mendukung async/await
const promisePool = pool.promise();

// Fungsi untuk menjalankan query menggunakan promise pool
async function queryDatabase(query, params = []) {
  try {
    const [rows] = await promisePool.query(query, params);
    return rows;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  }
}

// Memastikan koneksi tetap terjaga
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL!");
  connection.release(); // Melepaskan koneksi setelah digunakan
});

// Export pool dan fungsi query
module.exports = {
  queryDatabase,
  pool,
};
