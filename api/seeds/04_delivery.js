// НЕ СРАБОТАЕТ, НАДО ПЕРЕПИСЫВАТЬ ЭТОТ СИД

exports.seed = async function (knex) {
    // Очистка дочерней таблицы перед родительской
    await knex('address_delivery').del();
    await knex('delivery').del();

    // Вставка данных
    await knex('delivery').insert([
        {
            id: 1,
            inn: '7722753969',
            client: 'ООО "ВсеИнструменты.ру"',
        },
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
            latitude: 55.650898, //широта
            longitude: 37.860358, //долгота
        },
        {
            delivery_id: 1,
            address: 'Мытищи',
            date: '02022024',
            latitude: 55.650098, //широта
            longitude: 37.860058, //долгота
        },
        {
            delivery_id: 2,
            address: 'Москва ул. Бутлерова д.22',
            date: '03032024',
            latitude: 55.650098, //широта
            longitude: 37.860000, //долгота
        },
    ]);
};
