//  обновление seeds и миграции(предварительно удалив бд):
// если нужен полный сброс, то npx knex migrate:rollback --all
//  npx knex migrate:latest, то что пересоздает, формирует структуру бд по новым правилам в миграциях
//  npx knex seed:run, в принципе сиды уже не нужна на продакшине

exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('tk');

    if (!exists) {
        await knex.schema.createTable('tk', (table) => {
            table.increments('id').primary();
            table.string('name', 128).unique().notNullable();
            // Булевы значения через 0/1 с проверкой
            table
                .integer('bid')
                .notNullable()
                .defaultTo(0)
                .checkIn([0, 1])
                // .check('bid', 'bid_boolean_check', ['0', '1']); // или .checkIn([0, 1])
            table
                .integer('marker')
                .notNullable()
                .defaultTo(0)
                .checkIn([0, 1])
                // .check('marker', 'marker_boolean_check', ['0', '1']);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('tk');
};
