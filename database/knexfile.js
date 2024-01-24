import dotenv from 'dotenv';
// when running npx knex migrate:latest, it expects the .env file to be in the same directory as the knexfile.js by default
// so we need to specify the path to the .env fileœ
dotenv.config({path: "../.env"});


export const development = {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  };