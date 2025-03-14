exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('phones');

    if (!exists) {
        await knex.schema.createTable('phones', (table) => {
            table.increments('id').primary();
            table
                .integer('branch_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('branches')
                .onDelete('CASCADE');
            table.string('phone');
            table.string('extension');
            table.string('note_phone');
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('phones');
};
