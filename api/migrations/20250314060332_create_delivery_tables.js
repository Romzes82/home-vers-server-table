exports.up = async function (knex) {
    await knex.schema.createTable('delivery', (table) => {
        table.increments('id').primary();
        table.string('inn').notNullable();
        table.string('client').notNullable();
        table.unique(['inn', 'client']);
    });

    await knex.schema.createTable('address_delivery', (table) => {
        table.increments('id').primary();
        table
            .integer('delivery_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('delivery')
            .onDelete('CASCADE');
        table.string('address').notNullable();
        table.string('date').notNullable(); // Новый формат: YYYY-MM-DD
        table.real('latitude');
        // .notNullable()
        // .checkBetween([-90,90]); //широта
        table.real('longitude');
        // .notNullable()
        // .checkBetween([-180,180]); //долгота

        // Уникальный индекс для пары delivery_id + address
        table.unique(['delivery_id', 'address']);
    });

    // Добавляем индекс для ускорения сортировки по дате
    await knex.schema.raw(`
        CREATE INDEX idx_address_delivery_date 
        ON address_delivery(date DESC)
    `);
};

exports.down = async function (knex) {
    await knex.schema.dropTable('address_delivery');
    await knex.schema.dropTable('delivery');
    // await knex.raw('VACUUM'); если понадобиться сжатие бд
};
