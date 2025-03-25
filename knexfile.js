// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: './api/dataDeliveryAndTk.db3',
        },
        migrations: {
            directory: './api/migrations',
        },
        seeds: {
            directory: './api/seeds',
        },
        // логирование SQL-запросов в консоль - debug: true, но только для разработки
        debug: process.env.NODE_ENV !== 'production',
        useNullAsDefault: true,
    },
};
