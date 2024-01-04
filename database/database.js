import knex from 'knex';
import { development } from './knexfile.js';

const db = knex(development);

export default db;