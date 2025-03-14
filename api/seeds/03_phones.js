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
    await knex('phones').del();
    await knex('phones').insert([
        {
            branch_id: 1,
            phone: '(495) 775-55-30',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 2,
            phone: '8-800-800-80-80',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 3,
            phone: '(495) 358-77-29',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 3,
            phone: '8-915-407-42-44',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 4,
            phone: '8-800-505-34-95',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 4,
            phone: '8-963-853-90-09',
            extension: '',
            note_phone: '',
        },
        {
            branch_id: 4,
            phone: '(499) 700-00-97',
            extension: '',
            note_phone: '',
        },
    ]);
};
