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
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTable('address_delivery');
    await knex.schema.dropTable('delivery');
};
