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
    // Очистка дочерней таблицы перед родительской
    await knex('address_delivery').del();
    await knex('delivery').del();

    // Вставка данных
    await knex('delivery').insert([
        { id: 1, inn: '7722753969', client: 'ООО "ВсеИнструменты.ру"' },
        {
            id: 2,
            inn: '7728471978',
            client: 'Общество с ограниченной ответственностью "ЧАЙХОНАБУТ"',
        },
    ]);

    await knex('address_delivery').insert([
        {
            delivery_id: 1,
            address: 'Константиново, Объездное ш., с03',
            date: '01012024',
        },
        {
            delivery_id: 1,
            address: 'Мытищи',
            date: '02022024',
        },
        {
            delivery_id: 2,
            address: 'Москва ул. Бутлерова д.22',
            date: '03032024',
        },
    ]);
};
