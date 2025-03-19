exports.up = async function (knex) {
    await knex.schema
        .createTable('delivery', (table) => {
            table.increments('id').primary();
            table.string('inn').notNullable();
            table.string('client').notNullable();
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
        table.string('date').notNullable(); // Формат: DDMMYYYY
        table
            .real('latitude')
            .notNullable()
            // .checkBetween([-90,90]); //широта
        table
            .real('longitude')
            .notNullable()
            // .checkBetween([-180,180]); //долгота
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTable('address_delivery');
    await knex.schema.dropTable('delivery');
};
