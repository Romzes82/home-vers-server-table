const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const db = require('./dbConfig');

const server = express();

server.use(cors());
server.use(helmet());
server.use(express.json());

server.get('/', (req, res) => {
    res.send('Welcome to the Table app server!');
});

server.get('/delivery', async (req, res) => {
    //GET all todos
    try {
        console.log(req.query);
        const delivery = await db('delivery');
        res.json(delivery);
    } catch (err) {
        console.log(err);
    }
});

server.post('/todos', (req, res) => {
    //POST a todo
});

server.put('/todos/:id', (req, res) => {
    //UPDATE a todo
});

server.delete('/todos/:id', (req, res) => {
    //DELETE a todo
});

// Получение данных по массиву номеров для транспортных компаний
server.post('/tk/get-by-numbers', async (req, res) => {
    try {
        const { numbers } = req.body;

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Неверный формат номеров' });
        }

        const normalizeNumber = (stringWithNumbers) => {
            const str = stringWithNumbers.match(/(?:\+|\d)[\d\-\(\) ]{7,}\d/g);
            if (!str) return [];
            return str.map((num) => num.replace(/\D/g, ''));
        };

        for (const num of numbers) {
            try {
                const normalized = normalizeNumber(num);
                const phoneRecord = await db('phones')
                    .whereRaw(
                        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') = ?",
                        normalized.join('') // Нормализуем номер до строки
                    )
                    .first();

                if (phoneRecord) {
                    // Получаем все данные за минимальное количество запросов
                    const branchInfo = await db('branches')
                        .where({ id: phoneRecord.branch_id })
                        .first()
                        .select('tk_id', 'address');

                    // Один запрос для получения данных ТК
                    const tkInfo = await db('tk')
                        .where({ id: branchInfo.tk_id })
                        .first()
                        .select('name', 'bid', 'marker');

                    // Получаем все филиалы с координатами за один запрос
                    const allBranches = await db('branches')
                        .where({ tk_id: branchInfo.tk_id })
                        .select(
                            'id',
                            'address',
                            'note_branch',
                            'work_time',
                            'latitude as lat',
                            'longitude as lng'
                        );

                    // Получаем ВСЕ телефоны для этих филиалов
                    const branchIds = allBranches.map((b) => b.id);

                    const allPhones = await db('phones')
                        .whereIn('branch_id', branchIds)
                        .select(
                            'branch_id',
                            'phone',
                            'extension',
                            'note_phone'
                        );

                    // Формируем координаты
                    const coordinates = allBranches.map((branch) => ({
                        lat: branch.lat,
                        lng: branch.lng,
                    }));
                    // Формируем телефоны
                    // const phones = allPhones.map((p) => ({
                    //     phone: p.phone,
                    //     extension: p.extension || '',
                    //     note_phone: p.note_phone || '',
                    // }));

                    // Группируем телефоны по branch_id
                    const phonesByBranch = allBranches.map((branch) => {
                        return allPhones
                            .filter((phone) => phone.branch_id === branch.id)
                            .map((phone) => ({
                                phone: phone.phone,
                                extension: phone.extension || '',
                                note_phone: phone.note_phone || '',
                            }));
                    });

                    return res.json({
                        company: tkInfo.name,
                        bid: tkInfo.bid,
                        marker: tkInfo.marker,
                        branches: allBranches.map((b) => b.address),
                        note: allBranches.map((b) => b.note_branch || ''),
                        worktime: allBranches.map((b) => b.work_time),
                        coordinates: coordinates,
                        phones: phonesByBranch, // массив массивов с объектами-телефонами по филиалам
                    });
                }
            } catch (err) {
                console.error(`Ошибка обработки номера ${num}:`, err);
            }
        }

        return res.status(404).json({
            error: 'Ни один из номеров не найден в базе данных',
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Ошибка сервера при обработке запроса',
        });
    }
});

// Получение данных по ИНН
server.get('/delivery/get-by-inn', async (req, res) => {
    const { inn } = req.query;

    try {
        //сокращаем обращение к серверу с двух до одного
        const [delivery, addressData] = await Promise.all([
            db('delivery').where({ inn }).first().select('id', 'inn', 'client'),
            db('address_delivery')
                // выбираем данные и делаем сортировку по дате
                .where(
                    'delivery_id',
                    db('delivery').where({ inn }).select('id')
                )
                .orderBy('date', 'asc')
                .select(
                    'address',
                    'date',
                    'latitude as lat',
                    'longitude as lng'
                ),
        ]);

        // Получаем основную информацию о доставке
        // const delivery = await db('delivery')
        //     .where({ inn })
        //     .first()
        //     .select('id', 'inn', 'client');
        if (!delivery) {
            return res.status(404).json({
                error: 'Данные не найдены для указанного ИНН',
            });
        }

        // Получаем связанные адреса с координатами
        // const addressData = await db('address_delivery')
        //     .where({ delivery_id: delivery.id })
        //     .select('address', 'latitude as lat', 'longitude as lng');

        // Формируем ответ
        res.json({
            inn: delivery.inn,
            addresses: addressData.map((a) => a.address),
            history: addressData.map((a) => a.date),
            coordinates: addressData.map(({ lat, lng }) => ({ lat, lng })),
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            inn: inn || '',
            addresses: [],
            coordinates: [],
            history: [],
            error: 'Ошибка сервера при получении данных',
        });
    }
});

// Получение данных по массиву номеров для транспортных компаний
server.post('/tk/get-by-numbers', async (req, res) => {
    try {
        const { numbers } = req.body;

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Неверный формат номеров' });
        }

        const normalizeNumber = (stringWithNumbers) => {
            const str = stringWithNumbers.match(/(?:\+|\d)[\d\-\(\) ]{7,}\d/g);
            if (!str) return [];
            return str.map((num) => num.replace(/\D/g, ''));
        };

        for (const num of numbers) {
            try {
                const normalized = normalizeNumber(num);
                const phoneRecord = await db('phones')
                    .whereRaw(
                        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') = ?",
                        normalized.join('') // Нормализуем номер до строки
                    )
                    .first();

                if (phoneRecord) {
                    // Получаем все данные за минимальное количество запросов
                    const branchInfo = await db('branches')
                        .where({ id: phoneRecord.branch_id })
                        .first()
                        .select('tk_id', 'address');

                    // Один запрос для получения данных ТК
                    const tkInfo = await db('tk')
                        .where({ id: branchInfo.tk_id })
                        .first()
                        .select('name', 'bid', 'marker');

                    // Получаем все филиалы с координатами за один запрос
                    const allBranches = await db('branches')
                        .where({ tk_id: branchInfo.tk_id })
                        .select(
                            'id',
                            'address',
                            'note_branch',
                            'work_time',
                            'latitude as lat',
                            'longitude as lng'
                        );

                    // Получаем ВСЕ телефоны для этих филиалов
                    const branchIds = allBranches.map((b) => b.id);

                    const allPhones = await db('phones')
                        .whereIn('branch_id', branchIds)
                        .select(
                            'branch_id',
                            'phone',
                            'extension',
                            'note_phone'
                        );

                    // Формируем координаты
                    const coordinates = allBranches.map((branch) => ({
                        lat: branch.lat,
                        lng: branch.lng,
                    }));
                    // Формируем телефоны
                    // const phones = allPhones.map((p) => ({
                    //     phone: p.phone,
                    //     extension: p.extension || '',
                    //     note_phone: p.note_phone || '',
                    // }));

                    // Группируем телефоны по branch_id
                    const phonesByBranch = allBranches.map((branch) => {
                        return allPhones
                            .filter((phone) => phone.branch_id === branch.id)
                            .map((phone) => ({
                                phone: phone.phone,
                                extension: phone.extension || '',
                                note_phone: phone.note_phone || '',
                            }));
                    });

                    return res.json({
                        company: tkInfo.name,
                        bid: tkInfo.bid,
                        marker: tkInfo.marker,
                        branches: allBranches.map((b) => b.address),
                        note: allBranches.map((b) => b.note_branch || ''),
                        worktime: allBranches.map((b) => b.work_time),
                        coordinates: coordinates,
                        phones: phonesByBranch, // массив массивов с объектами-телефонами по филиалам
                    });
                }
            } catch (err) {
                console.error(`Ошибка обработки номера ${num}:`, err);
            }
        }

        return res.status(404).json({
            error: 'Ни один из номеров не найден в базе данных',
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Ошибка сервера при обработке запроса',
        });
    }
});

// Получение данных по Названию клиента
server.get('/delivery/get-by-client', async (req, res) => {
    const { client } = req.query;

    try {
        //сокращаем обращение к серверу с двух до одного
        const [delivery, addressData] = await Promise.all([
            db('delivery')
                .where({ client })
                .first()
                .select('id', 'inn', 'client'),
            db('address_delivery')
                // выбираем данные и делаем сортировку по дате
                .where(
                    'delivery_id',
                    db('delivery').where({ client }).select('id')
                )
                .orderBy('date', 'asc')
                .select(
                    'address',
                    'date',
                    'latitude as lat',
                    'longitude as lng'
                ),
        ]);

        if (!delivery) {
            return res.status(404).json({
                error: 'Данные не найдены для указанного ИНН',
            });
        }

        // Формируем ответ
        res.json({
            client: delivery.client,
            addresses: addressData.map((a) => a.address),
            history: addressData.map((a) => a.date),
            coordinates: addressData.map(({ lat, lng }) => ({ lat, lng })),
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            client: client || '',
            addresses: [],
            coordinates: [],
            history: [],
            error: 'Ошибка сервера при получении данных',
        });
    }
});

// Роут для получения списка ТК в алфавитном порядке

server.get('/tk/get-names', async (req, res) => {
    try {
        // Запрос к базе данных для получения списка ТК, отсортированного по полю `name`
        const tkList = await db('tk')
            .pluck('name') // Выбираем массив значений поле `name`
            .orderBy('name', 'asc'); // Сортируем по алфавиту (asc - по возрастанию)
        // Отправляем результат клиенту
        res.status(200).json(tkList);
    } catch (error) {
        console.error('Ошибка при получении списка ТК:', error);
        res.status(500).json({
            error: 'Ошибка сервера при получении списка ТК',
        });
    }
});

module.exports = server;

// server.get('/delivery/get-by-inn', async (req, res) => {
//     const { inn } = req.query;
//     try {
//         // Получаем основную информацию о доставке
//         const delivery = await db('delivery')
//             .where({ inn })
//             .first()
//             .select('id', 'inn', 'client');
//         // console.log(delivery);
//         if (!delivery) {
//             return res.status(404).json({
//                 error: 'Данные не найдены для указанного ИНН'
//             });
//         }

//         // Получаем связанные адреса доставки
//         const addresses = delivery
//             ? (await db('address_delivery')
//                 .where({ delivery_id: delivery.id })
//                 .select('address'))
//             : [];

//         // Формируем ответ
//         res.json({
//             inn: delivery.inn,
//             addresses: addresses.map(a => a.address) || []
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             inn,
//             addresses: [] // всегда возвращать массив
//             // error: 'Ошибка сервера при получении данных'
//         });
//     }
// });

// // Получение данных по массиву номеров для транспортных компаний

// server.post('/tk/get-by-numbers', async (req, res) => {
//     try {
//         const { numbers } = req.body;
//         // Валидация входных данных
//         if (!Array.isArray(numbers) || numbers.length === 0) {
//             return res.status(400).json({ error: 'Неверный формат номеров' });
//         }
//         // Функция для нормализации номера
//         // const normalizeNumber = (num) => num.replace(/[-+()\s]/g, '');
//         function normalizeNumber(stringWithNumbers) {
//             const str = stringWithNumbers.match(/(?:\+|\d)[\d\-\(\) ]{7,}\d/g);
//             // const digits = str[0].replace(/\D/g, '');
//             if (!str) return [];
//             const res = [];
//             str.forEach((num) => res.push(num.replace(/\D/g, '')));
//             return res;
//             // console.log(res);
//         }

//         // Поиск первого подходящего номера
//         for (const num of numbers) {
//             try {
//                 const normalized = normalizeNumber(num);
//                 const phoneRecord = await db('phones')
//                     .whereRaw(
//                         "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') = ?",
//                         normalized
//                     )
//                     .first()
//                     .select('branch_id');
//                 if (phoneRecord) {
//                     // Дальнейшая логика обработки найденного номера

//                     const branchInfo = await db('branches')
//                         .where({ id: phoneRecord.branch_id })
//                         .first()
//                         .select('tk_id', 'address');
//                     const tkInfo = await db('tk')
//                         .where({ id: branchInfo.tk_id })
//                         .first()
//                         .select('name');
//                     const tkBid = await db('tk')
//                         .where({ id: branchInfo.tk_id })
//                         .first()
//                         .select('bid');
//                     const tkMarker = await db('tk')
//                         .where({ id: branchInfo.tk_id })
//                         .first()
//                         .select('marker');
//                     const allBranches = await db('branches')
//                         .where({ tk_id: branchInfo.tk_id })
//                         .select('address');
//                     const allBranchesNotes = await db('branches')
//                             .where({ tk_id: branchInfo.tk_id })
//                             .select('note_branch');
//                     const allBranchesWorkTime = await db('branches')
//                         .where({ tk_id: branchInfo.tk_id })
//                         .select('work_time');
//                     // const allBranchesLat = await db('branches')
//                     //     .where({ tk_id: branchInfo.tk_id })
//                     //     .select('latitude');
//                     // const allBranchesLng = await db('branches')
//                     //     .where({ tk_id: branchInfo.tk_id })
//                     //     .select('longitude');

//                     return res.json({
//                         company: tkInfo.name,
//                         bid: tkBid.bid,
//                         marker: tkMarker.marker,
//                         branches: allBranches.map((b) => b.address),
//                         note: allBranchesNotes.map((b) => b.note_branch),
//                         worktime: allBranchesWorkTime.map((b) => b.work_time),
//                         //  coordinates: allBranchesLat.map((b) => b.latitude),
//                     });
//                 }
//             } catch (err) {
//                 console.error(`Ошибка обработки номера ${num}:`, err);
//                 // Продолжаем проверять следующие номера
//             }
//         }

//         // Если ни один номер не найден
//         return res.status(404).json({
//             error: 'Ни один из номеров не найден в базе данных',
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             error: 'Ошибка сервера при обработке запроса',
//         });
//     }
// });

// // Получение данных по ОДНОМУ номеру для транспортных компаний

// server.get('/tk/get-by-number', async (req, res) => {
//     try {
//         const { number } = req.query;
//         // 1. Находим телефон и связанный филиал
//         const phoneRecord = await db('phones')
//             // .where({ phone: number })
//             // удаляем из номера -, ,+,(,)
//             .whereRaw(
//                 "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') = ?",
//                 number
//             )
//             .first()
//             .select('branch_id');
//         if (!phoneRecord) {
//             return res.status(404).json({
//                 error: 'Номер не найден в базе данных',
//             });
//         }
//         // 2. Получаем информацию о филиале и транспортной компании
//         const branchInfo = await db('branches')
//             .where({ id: phoneRecord.branch_id })
//             .first()
//             .select('tk_id', 'address');
//         if (!branchInfo) {
//             return res.status(404).json({
//                 error: 'Филиал не найден',
//             });
//         }
//         // 3. Получаем название транспортной компании
//         const tkInfo = await db('tk')
//             .where({ id: branchInfo.tk_id })
//             .first()
//             .select('name');
//         if (!tkInfo) {
//             return res.status(404).json({
//                 error: 'Транспортная компания не найдена',
//             });
//         }
//         // 4. Получаем все филиалы компании
//         const allBranches = await db('branches')
//             .where({ tk_id: branchInfo.tk_id })
//             .select('address');
//         // 5. Формируем ответ
//         res.json({
//             company: tkInfo.name,
//             branches: allBranches.map((b) => b.address),
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             error: 'Ошибка сервера при получении данных',
//         });
//     }
// });
