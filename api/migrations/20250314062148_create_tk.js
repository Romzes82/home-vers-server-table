exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('tk');

    if (!exists) {
        await knex.schema.createTable('tk', (table) => {
            table.increments('id').primary();
            table.string('name', 128).unique().notNullable();
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('tk');
};
