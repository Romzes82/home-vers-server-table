exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('branches');

    if (!exists) {
        await knex.schema.createTable('branches', (table) => {
            table.increments('id').primary();
            table
                .integer('tk_id')
                .unsigned()
                .notNullable()
                .references('id')
                .inTable('tk')
                .onDelete('CASCADE');
            table.string('address');
            table.string('work_time');
            table.string('note_branch');
            table
                .real('latitude')
                .notNullable()
                // .check('latitude', 'lat_range', 'latitude BETWEEN -90 AND 90'); //широта
            table
                .real('longitude')
                .notNullable()
                // .check('longitude','lng_range','longitude BETWEEN -180 AND 180'); //долгота
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('branches');
};
