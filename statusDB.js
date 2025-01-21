const { queryDatabase } = require("./db");

const createStatusTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS status (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customID varchar(50) DEFAULT NULL,
      status varchar(50) DEFAULT NULL,
      time datetime DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    // Menjalankan query untuk membuat tabel
    await queryDatabase(sql);
    console.log("Table 'status' created successfully or already exists.");
  } catch (err) {
    console.error("Error creating table: ", err);
  }
};

module.exports = createStatusTable;
