// /**
//  * @param { import("knex").Knex } knex
//  * @returns { Promise<void> } 
//  */
// exports.seed = async function(knex) {
//   // Deletes ALL existing entries
//   await knex('table_name').del()
//   await knex('table_name').insert([
//     {id: 1, colName: 'rowValue1'},
//     {id: 2, colName: 'rowValue2'},
//     {id: 3, colName: 'rowValue3'}
//   ]);
// };

exports.seed = async function (knex) {
    await knex('tk').del();
    await knex('tk').insert([
        { id: 1, name: 'тк Деловые Линии' },
        { id: 2, name: 'тк Артэк' },
        { id: 3, name: 'тк Азимут' },
    ]);
};