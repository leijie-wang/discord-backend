import 'dotenv/config';

export const development = {
    client: 'mysql2',
    connection: {
      host: "localhost",
      user: "root",
      password: "reporting",
      database: 'privacyreporting'
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  };