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
            note_branch: '',
            work_time: 'с 9-00 до 20-00',
            latitude: 55.659898, //широта
            longitude: 37.862358, //долгота
        },
        {
            tk_id: 1,
            address: 'Москва, ул. Подольских Курсантов, д. 17, к. 2',
            note_branch: '',
            work_time: 'с 00-00 до 24-00',
            latitude: 55.612345,
            longitude: 37.589012,
        },
        {
            tk_id: 2,
            address: 'Москва, 2ой Вязовский проезд, д. 16',
            note_branch: 'на территории строение № 9',
            work_time: 'с 9-00 до 18-00',
            latitude: 55.723456,
            longitude: 37.634567,
        },
        {
            tk_id: 3,
            address: 'МО, Старая Купавна, ул. Дорожная, стр. 15',
            note_branch: 'заезд с ул. Рабочая, поворот напротив часовни',
            work_time: 'с 9-00 до 18-00',
            latitude: 55.801234,
            longitude: 38.178901,
        },
    ]);
};
