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
    await knex('branches').del();
    await knex('branches').insert([
        {
            tk_id: 1,
            address: 'г. Котельники, Дзержинское ш., 14',
            work_time: 'с 9-00 до 20-00',
            note_branch: '',
        },
        {
            tk_id: 1,
            address: 'Москва, ул. Подольских Курсантов, д. 17, к. 2',
            work_time: 'с 00-00 до 24-00',
            note_branch: '',
        },
        {
            tk_id: 2,
            address: 'Москва, 2ой Вязовский проезд, д. 16',
            work_time: 'с 9-00 до 18-00',
            note_branch: 'на территории строение № 9',
        },
        {
            tk_id: 3,
            address: 'МО, Старая Купавна, ул. Дорожная, стр. 15',
            work_time: 'с 9-00 до 18-00',
            note_branch: 'заезд с ул. Рабочая, поворот напротив часовни',
        },
    ]);
};
