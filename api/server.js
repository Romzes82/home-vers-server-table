// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');

// const db = require('./dbConfig');

// const server = express();

// server.use(cors());
// server.use(helmet());
// server.use(express.json());

// ...........
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const XLSX = require('xlsx');
const fetch = require('node-fetch');
const db = require('./dbConfig');
const upload = multer({ dest: 'uploads/' });
const YANDEX_API_KEY = '1b602826-be94-4853-aa6f-23bc3971a6d9';

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

// Получение данных по имени транспортной компании
server.get('/tk/get-by-name', async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string') {
            return res
                .status(400)
                .json({ error: 'Неверный формат названия ТК' });
        }

        // Поиск ТК по названию (регистронезависимый поиск)
        const tk = await db('tk')
            // .whereRaw('LOWER(name) LIKE ?', [`%${name.toLowerCase()}%`])
            .where('name', '=', name)
            .first();

        if (!tk) {
            return res
                .status(404)
                .json({ error: 'Транспортная компания не найдена' });
        }

        // Получение всех филиалов ТК
        const branches = await db('branches')
            .where('tk_id', tk.id)
            .select(
                'id',
                'address',
                'note_branch as note',
                'work_time as worktime',
                'latitude as lat',
                'longitude as lng'
            );

        // Получение всех телефонов филиалов
        const branchIds = branches.map((b) => b.id);
        const phones = await db('phones')
            .whereIn('branch_id', branchIds)
            .select('branch_id', 'phone', 'extension', 'note_phone');

        // Форматирование результата
        const result = {
            company: tk.name,
            bid: tk.bid,
            marker: tk.marker,
            branches: branches.map((b) => b.address),
            note: branches.map((b) => b.note || ''),
            worktime: branches.map((b) => b.worktime),
            coordinates: branches.map((b) => ({
                lat: b.lat,
                lng: b.lng,
            })),

            phones: branches.map((branch) =>
                phones
                    .filter((p) => p.branch_id === branch.id)
                    .map((p) => ({
                        phone: p.phone,
                        extension: p.extension || '',
                        note_phone: p.note_phone || '',
                    }))
            ),
        };

        res.json(result);
    } catch (err) {
        console.error('Ошибка в /tk/get-by-name:', err);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            details: err.message,
        });
    }
});

// // Получение данных по ИНН
// server.get('/delivery/get-by-inn', async (req, res) => {
//     const { inn } = req.query;

//     try {
//         //сокращаем обращение к серверу с двух до одного
//         const [delivery, addressData] = await Promise.all([
//             db('delivery').where({ inn }).first().select('id', 'inn', 'client'),
//             db('address_delivery')
//                 // выбираем данные и делаем сортировку по дате
//                 .where(
//                     'delivery_id',
//                     db('delivery').where({ inn }).select('id')
//                 )
//                 .orderBy('date', 'asc')
//                 .select(
//                     'address',
//                     'date',
//                     'latitude as lat',
//                     'longitude as lng'
//                 ),
//         ]);

//         // Получаем основную информацию о доставке
//         // const delivery = await db('delivery')
//         //     .where({ inn })
//         //     .first()
//         //     .select('id', 'inn', 'client');
//         if (!delivery) {
//             return res.status(404).json({
//                 error: 'Данные не найдены для указанного ИНН',
//             });
//         }

//         // Получаем связанные адреса с координатами
//         // const addressData = await db('address_delivery')
//         //     .where({ delivery_id: delivery.id })
//         //     .select('address', 'latitude as lat', 'longitude as lng');

//         // Формируем ответ
//         res.json({
//             inn: delivery.inn,
//             addresses: addressData.map((a) => a.address),
//             history: addressData.map((a) => a.date),
//             coordinates: addressData.map(({ lat, lng }) => ({ lat, lng })),
//         });
//     } catch (err) {
//         console.error(err);

//         res.status(500).json({
//             inn: inn || '',
//             addresses: [],
//             coordinates: [],
//             history: [],
//             error: 'Ошибка сервера при получении данных',
//         });
//     }
// });

// // Получение данных по Названию клиента
// server.get('/delivery/get-by-client', async (req, res) => {
//     const { client } = req.query;

//     try {
//         //сокращаем обращение к серверу с двух до одного
//         const [delivery, addressData] = await Promise.all([
//             db('delivery')
//                 .where({ client })
//                 .first()
//                 .select('id', 'inn', 'client'),
//             db('address_delivery')
//                 // выбираем данные и делаем сортировку по дате
//                 .where(
//                     'delivery_id',
//                     db('delivery').where({ client }).select('id')
//                 )
//                 .orderBy('date', 'asc')
//                 .select(
//                     'address',
//                     'date',
//                     'latitude as lat',
//                     'longitude as lng'
//                 ),
//         ]);

//         if (!delivery) {
//             return res.status(404).json({
//                 error: 'Данные не найдены для указанного ИНН',
//             });
//         }

//         // Формируем ответ
//         res.json({
//             client: delivery.client,
//             addresses: addressData.map((a) => a.address),
//             history: addressData.map((a) => a.date),
//             coordinates: addressData.map(({ lat, lng }) => ({ lat, lng })),
//         });
//     } catch (err) {
//         console.error(err);

//         res.status(500).json({
//             client: client || '',
//             addresses: [],
//             coordinates: [],
//             history: [],
//             error: 'Ошибка сервера при получении данных',
//         });
//     }
// });

// Получение данных по ИНН
// server.get('/delivery/get-by-inn', async (req, res) => {
//     const { inn } = req.query;

//     try {
//         // 1. Находим запись в delivery

//         const delivery = await db('delivery')
//             .where({ inn })

//             .first()

//             .select('id', 'inn', 'client');

//         if (!delivery) {
//             return res.status(404).json({
//                 error: 'Данные не найдены для указанного ИНН',
//             });
//         }

//         // 2. Получаем все связанные адреса

//         const addressData = await db('address_delivery')
//             .where({ delivery_id: delivery.id })

//             .orderBy('date', 'asc')

//             .select(
//                 'address',

//                 'date',

//                 'latitude as lat',

//                 'longitude as lng'
//             );

//         // 3. Преобразуем координаты к числовому формату

//         const coordinates = addressData.map(({ lat, lng }) => ({
//             lat: parseFloat(lat),

//             lng: parseFloat(lng),
//         }));

//         // 4. Формируем ответ

//         res.json({
//             inn: delivery.inn,

//             addresses: addressData.map((a) => a.address),

//             history: addressData.map((a) => a.date),

//             coordinates: coordinates,
//         });
//     } catch (err) {
//         console.error(err);

//         res.status(500).json({
//             inn: inn || '',

//             addresses: [],

//             coordinates: [],

//             history: [],

//             error: 'Ошибка сервера при получении данных',

//             details: err.message,
//         });
//     }
// });

// Получение данных по названию клиента
// server.get('/delivery/get-by-client', async (req, res) => {
//     const { client } = req.query;

//     try {
//         // 1. Находим все записи delivery для клиента
//         const deliveries = await db('delivery')
//             .where({ client })
//             .select('id', 'inn', 'client');

//         if (deliveries.length === 0) {
//             return res.status(404).json({
//                 error: 'Данные не найдены для указанного клиента',
//             });
//         }

//         // 2. Получаем все delivery_id
//         const deliveryIds = deliveries.map((d) => d.id);

//         // 3. Получаем все адреса доставки
//         const addressData = await db('address_delivery')
//             .whereIn('delivery_id', deliveryIds)
//             .orderBy('date', 'asc')
//             .select('address', 'date', 'latitude as lat', 'longitude as lng');

//         // 4. Формируем ответ

//         res.json({
//             client: client,
//             addresses: addressData.map((a) => a.address),
//             history: addressData.map((a) => a.date),
//             coordinates: addressData.map((a) => ({
//                 lat: parseFloat(a.lat),
//                 lng: parseFloat(a.lng),
//             })),
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             error: 'Ошибка сервера при получении данных',
//             details: err.message,
//         });
//     }
// });

// Получение данных по инн и названию клиента
server.get('/delivery/get-by-inn-and-client', async (req, res) => {
    const { inn, client } = req.query;

    // Валидация входных параметров
    if (!inn || !client) {
        return res.status(400).json({
            error: 'Необходимо указать оба параметра: ИНН и название клиента',
        });
    }

    try {
        // Поиск клиента с проверкой уникальности
        const delivery = await db('delivery')
            .where({
                inn: inn.toString().replace(/\.0$/, ''),
                client: client.trim(),
            })
            .first();

        if (!delivery) {
            return res.status(404).json({
                error: 'Клиент с указанными ИНН и названием не найден',
            });
        }

        // Получаем адреса с сортировкой по дате по убыванию ( новые -> старые)
        const addresses = await db('address_delivery')
            .where('delivery_id', delivery.id)
            .orderBy('date', 'desc') // Сортируем от новых к старым
            .select('address', 'date', 'latitude', 'longitude');

        // Фильтруем дубликаты адресов (оставляем последнюю запись)
        const uniqueAddresses = addresses.reduce((acc, curr) => {
            if (!acc.has(curr.address)) {
                acc.set(curr.address, curr);
            }

            return acc;
        }, new Map());

        // Формируем массивы из уникальных записей
        // const filteredData = Array.from(uniqueAddresses.values()).reverse(); // Восстанавливаем хронологический порядок
        const filteredData = Array.from(uniqueAddresses.values()); // Восстанавливаем хронологический порядок

        // Формирование ответа
        const response = {
            inn: delivery.inn,
            client: delivery.client,
            addresses: filteredData.map((a) => a.address),
            history: filteredData.map((a) => a.date),

            coordinates: filteredData.map((a) => ({
                lat: parseFloat(a.latitude),
                lng: parseFloat(a.longitude),
            })),
        };

        res.json(response);

        // // Получение истории доставок
        // const addresses = await db('address_delivery')
        //     .where('delivery_id', delivery.id)
        //     .orderBy('date', 'asc')
        //     .select('address', 'date', 'latitude', 'longitude');

        // // Формирование ответа
        // const response = {
        //     inn: delivery.inn,
        //     client: delivery.client,
        //     addresses: addresses.map((a) => a.address),
        //     history: addresses.map((a) => a.date),
        //     coordinates: addresses.map((a) => ({
        //         lat: parseFloat(a.latitude),
        //         lng: parseFloat(a.longitude),
        //     })),
        // };

        // res.json(response);
    } catch (error) {
        console.error('Ошибка получения данных:', error);

        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            details: error.message,
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

// НИЖЕ для админ-панели
// Получение полных данных

server.get('/api/tk-full-data', async (req, res) => {
    try {
        const tkData = await db('tk')
            .select(
                'tk.id as tk_id',
                'tk.name as tk_name',
                'branches.*',
                'phones.*'
            )

            .leftJoin('branches', 'tk.id', 'branches.tk_id')

            .leftJoin('phones', 'branches.id', 'phones.branch_id');

        // Ручная группировка данных

        const grouped = tkData.reduce((acc, row) => {
            const tk = acc.find((t) => t.id === row.tk_id) || {
                id: row.tk_id,

                name: row.tk_name,

                branches: [],
            };

            const branch = tk.branches.find((b) => b.id === row.branch_id) || {
                id: row.id,

                address: row.address,

                phones: [],
            };

            if (row.phone) {
                branch.phones.push({
                    id: row.phone_id,

                    phone: row.phone,

                    extension: row.extension,
                });
            }

            if (!tk.branches.some((b) => b.id === branch.id)) {
                tk.branches.push(branch);
            }

            if (!acc.some((t) => t.id === tk.id)) {
                acc.push(tk);
            }

            return acc;
        }, []);

        res.json(grouped);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

// или
// Получение всех данных

server.get('/api/tk', async (req, res) => {
    try {
        const tks = await db('tk').select('*');
        const branches = await db('branches').select('*');
        const phones = await db('phones').select('*');

        const data = tks.map((tk) => ({
            ...tk,
            branches: branches
                .filter((b) => b.tk_id === tk.id)
                .map((b) => ({
                    ...b,
                    phones: phones.filter((p) => p.branch_id === b.id),
                })),
        }));

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

// Эндпоинт для ручного добавления
server.post('/api/tk', async (req, res) => {
    try {
        const { name, bid, marker, branches } = req.body;

        // Вставка ТК

        const [tk] = await db('tk')
            .insert({ name, bid, marker })

            .returning('*');

        // Вставка филиалов и телефонов

        for (const branchData of branches) {
            const { phones, ...branch } = branchData;

            // Вставка филиала

            const [dbBranch] = await db('branches')
                .insert({
                    ...branch,

                    tk_id: tk.id,

                    latitude: parseFloat(branch.latitude),

                    longitude: parseFloat(branch.longitude),
                })

                .returning('*');

            // Вставка телефонов

            if (phones && phones.length > 0) {
                await db('phones').insert(
                    phones.map((phone) => ({
                        ...phone,

                        branch_id: dbBranch.id,
                    }))
                );
            }
        }

        res.status(201).json(tk);
    } catch (error) {
        console.error('Create error:', error);

        res.status(500).json({ error: 'Ошибка создания ТК' });
    }
});

// Эндпоинт для загрузки ТК Excel
server.post('/api/uploadAAA', upload.single('file'), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(sheet);

        for (const row of rows) {
            // Геокодирование

            const geoRes = await fetch(
                `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&format=json&geocode=${encodeURIComponent(
                    row.Адрес
                )}`
            );

            const geoData = await geoRes.json();

            const [lng, lat] =
                geoData.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(
                    ' '
                );

            // Поиск или создание ТК

            let tk = await db('tk')
                .where({ name: row['Название ТК'] })

                .first();

            if (!tk) {
                [tk] = await db('tk')
                    .insert({
                        name: row['Название ТК'],
                        bid: row.заявка === 'да' ? 1 : 0,
                        marker: row['марк.'] === 'да' ? 1 : 0,
                // const bid = row['заявка'].toString().trim() === 'да' ? 1 : 0;
                // const marker = row['марк.'].toString().trim() === 'да' ? 1 : 0;
                    })

                    .returning('*');
            }

            // Сохранение филиала

            const [branch] = await db('branches')
                .insert({
                    tk_id: tk.id,
                    address: row.Адрес,
                    work_time: row.Время,
                    note_branch: row['Коммент для адреса'],
                    latitude: lat,
                    longitude: lng,
                })
                .returning('*');

            // Сохранение телефонов

            const phones = row.Телефон.split(',').map((phone) => ({
                phone: phone.trim(),
                extension: '',
                note_phone: '',
            }));

            await db('phones').insert(
                phones.map((phone) => ({ ...phone, branch_id: branch.id }))
            );
        }

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Upload error:', error);

        res.status(500).json({
            error: 'Ошибка обработки файла',

            details: error.message,
        });
    }
});

// обновление в ТК только bid и маркер
server.post('/api/upload-only-bid-and-marker', upload.single('file'), async (req, res) => {
    const transaction = await db.transaction();

    const stats = {
        total: 0,
        updated: 0,
        created: 0,
        errors: [],
    };

    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        for (const [index, row] of rows.entries()) {
            stats.total++;

            const rowNum = index + 2;

            try {
                // 1. Нормализация данных
                const tkName = row['Название ТК']?.toString().trim();
                const rawBid = row.заявка?.toString().trim().toLowerCase();
                const rawMarker = row['марк.']?.toString().trim().toLowerCase();

                // 2. Валидация

                if (!tkName) {
                    stats.errors.push(
                        `Строка ${rowNum}: Отсутствует название ТК`
                    );

                    continue;
                }

                const bid = rawBid === 'да' ? 1 : 0;

                const marker = rawMarker === 'да' ? 1 : 0;

                // 3. Поиск или создание ТК
                const existingTk = await transaction('tk')
                    .where('name', tkName)
                    .first();
                if (existingTk) {
                    // Обновляем только изменившиеся поля
                    const updates = {};
                    if (existingTk.bid !== bid) updates.bid = bid;
                    if (existingTk.marker !== marker) updates.marker = marker;
                    if (Object.keys(updates).length > 0) {
                        await transaction('tk')
                            .where('id', existingTk.id)
                            .update(updates);
                        stats.updated++;
                    }
                } else {
                    await transaction('tk').insert({
                        name: tkName,
                        bid,
                        marker,
                    });

                    stats.created++;
                }
            } catch (error) {
                stats.errors.push(`Строка ${rowNum}: ${error.message}`);
            }
        }

        await transaction.commit();

        res.status(200).json({
            success: true,
            stats: {
                ...stats,
                skipped: stats.total - (stats.updated + stats.created),
            },
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Upload error:', error);

        res.status(500).json({
            success: false,
            error: 'Ошибка обработки файла',
            details: error.message,
        });
    }
});

// Вспомогательная функция для преобразования даты в формат DDMMYYYY и далеее в YYYY-MM-DD
const formatDeliveryDate = (input) => {
    // Преобразуем в строку и очищаем от нецифровых символов
    const cleaned = input.toString().replace(/\D/g, '');

    // Проверяем и корректируем длину
    let dateStr = cleaned;
    if (cleaned.length === 7) dateStr = `0${cleaned}`;
    if (dateStr.length !== 8) throw new Error('Некорректный формат даты');

    // Извлекаем компоненты
    const day = dateStr.slice(0, 2);
    const month = dateStr.slice(2, 4);
    const year = dateStr.slice(4);

    // Валидация
    if (parseInt(day) < 1 || parseInt(day) > 31)
        throw new Error('Неверный день');
    if (parseInt(month) < 1 || parseInt(month) > 12)
        throw new Error('Неверный месяц');
    if (parseInt(year) < 1900) throw new Error('Неверный год');

    // return `${day}${month}${year}`;
    return `${year}-${month}-${day}`;
};

// Добавим функцию для преобразования DDMMYYYY -> YYYY-MM-DD
// const formatDateToISO = (dateString) => {
//     if (!/^\d{8}$/.test(dateString)) {
//         throw new Error(`Неверный формат даты: ${dateString}`);
//     }

//     const day = dateString.slice(0, 2);
//     const month = dateString.slice(2, 4);
//     const year = dateString.slice(4, 8);
 
//     return `${year}-${month}-${day}`;
// };

// 1.0 Эндпоинт для загрузки доставок из xlsx в бд
// server.post('/api/upload-delivery', upload.single('file'), async (req, res) => {

//   try {
//     const workbook = XLSX.readFile(req.file.path, { cellDates: false, cellText: true});
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(sheet);

//     for (const row of rows) {

//       // Геокодирование адреса

//       //const geoRes = await fetch(

//         //`https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&format=json&geocode=${encodeURIComponent(row['Адрес доставки'])}`

//       //);

//       //const geoData = await geoRes.json();

//         //   const [lng, lat] = geoData.response.GeoObjectCollection.featureMember[0]
//       const [lng, lat] =[0, 0];

//       // Работа с основной записью доставки

//       let delivery = await db('delivery')

//         .where({ inn: row.ИНН })

//         .first();

//       if (!delivery) {

//         [delivery] = await db('delivery')
//             .insert({
//                 // inn: row.ИНН,
//                 inn: row.ИНН.toString().replace(/\.0$/,''),

//                 client: row.Клиент,
//             })

//             .returning('*');

//       }

//       // Преобразование даты в формат DDMMYYYY

//     //   const rawDate = new Date(row['Дата']);

//     //   const formattedDate = [

//     //     String(rawDate.getDate()).padStart(2, '0'),

//     //     String(rawDate.getMonth() + 1).padStart(2, '0'),

//     //     rawDate.getFullYear()

//         //   ].join('');

//         // Обработка даты

//         let formattedDate;

//         try {
//           formattedDate = formatDeliveryDate(row['Дата']);
//         } catch (dateError) {
//           errors.push(`Строка ${index + 2}: ${dateError.message}`);
//           continue;
//         }

//       // Сохранение адреса доставки

//       await db('address_delivery').insert({

//         delivery_id: delivery.id,

//         address: row['Адрес'],

//         date: formattedDate,

//         latitude: lat,

//         longitude: lng

//       });

//     }

//     res.status(201).json({ success: true });

//   } catch (error) {

//     console.error('Upload error:', error);

//     res.status(500).json({ error: 'Ошибка обработки файла доставок' });

//   }

// });

// 1.1. Эндпоинт для загрузки доставок из xlsx в бд
// server.post('/api/upload-delivery', upload.single('file'), async (req, res) => {
//     const errors = [];

//     try {
//         const workbook = XLSX.readFile(req.file.path, {
//             cellDates: false,
//             raw: false,
//         });

//         const sheet = workbook.Sheets[workbook.SheetNames[0]];

//         const rows = XLSX.utils.sheet_to_json(sheet);

//         for (const [index, row] of rows.entries()) {
//             try {
//                 // 1. Обработка ИНН

//                 const rawINN = row.ИНН
//                     .toString()
//                     .replace(/\.0$/, '')
//                     .replace(/\D/g, '');
                
//                 if (rawINN === 0) {
//                     rawINN;
//                 }

//                 // if (rawINN.length !== 10 && rawINN.length !== 12) {
//                 //     errors.push(`Строка ${index + 2}: Неверная длина ИНН`);

//                 //     continue;
//                 // }

//                 // 2. Поиск/создание записи в delivery

//                 let delivery = await db('delivery')
//                     .where({ inn: rawINN })
//                     .first();

//                 if (!delivery) {
//                     [delivery] = await db('delivery')
//                         .insert({ inn: rawINN, client: row.Клиент })

//                         .returning('*');
//                 }

//                 // 3. Обработка даты

//                 let formattedDate;

//                 try {
//                     formattedDate = formatDeliveryDate(row.Дата);
//                 } catch (e) {
//                     errors.push(`Строка ${index + 2}: ${e.message}`);

//                     continue;
//                 }

//                 // 4. Геокодирование (пример для Яндекс.Карт)

//                 // const geoResponse = await fetch(
//                 //     `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&format=json&geocode=${encodeURIComponent(
//                 //         row.Адрес
//                 //     )}`
//                 // );

//                 // const geoData = await geoResponse.json();

//                 // const [lng, lat] =
//                 //     geoData.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(
//                 //         ' '
//                 //     );
//                 const [lng, lat] = [0, 0];
//                 // 5. Вставка адреса

//                 await db('address_delivery').insert({
//                     delivery_id: delivery.id,

//                     address: row.Адрес,

//                     date: formattedDate,

//                     latitude: parseFloat(lat),

//                     longitude: parseFloat(lng),
//                 });
//             } catch (error) {
//                 errors.push(`Строка ${index + 2}: ${error.message}`);
//             }
//         }

//         const response = { success: true };

//         if (errors.length > 0) {
//             response.warnings = errors;

//             response.message = 'Часть данных не обработана';
//         }

//         res.status(errors.length ? 207 : 201).json(response);
//     } catch (error) {
//         console.error('Upload failed:', error);

//         res.status(500).json({
//             success: false,

//             error: 'Ошибка обработки файла',

//             details: error.message,
//         });
//     }
// });

// 1.2. Эндпоинт для загрузки доставок из xlsx в бд
// server.post('/api/upload-delivery', upload.single('file'), async (req, res) => {
//     const errors = [];

//     const transaction = await db.transaction();

//     try {
//         const workbook = XLSX.readFile(req.file.path, {
//             cellDates: false,
//             cellText: true,
//         });

//         const sheet = workbook.Sheets[workbook.SheetNames[0]];

//         const rows = XLSX.utils.sheet_to_json(sheet);

//         // Обрабатываем каждую строку как отдельную операцию

//         for (const [index, row] of rows.entries()) {
//             try {
//                 // Нормализация данных

//                 const inn = row.ИНН.toString().replace(/\.0$/, '').trim();

//                 const client = row.Клиент.toString().trim();

//                 const address = row['Адрес'].toString().trim();

//                 // Валидация обязательных полей

//                 if (!inn || !client || !address || !row['Дата']) {
//                     errors.push(
//                         `Строка ${index + 2}: Отсутствуют обязательные поля`
//                     );

//                     continue;
//                 }

//                 // Обработка даты

//                 let formattedDate;

//                 try {
//                     // Предполагаем, что row['Дата'] уже в формате DDMMYYYY
//                     formattedDate = formatDeliveryDate(row['Дата']);
//                 } catch (dateError) {
//                     errors.push(`Строка ${index + 2}: ${dateError.message}`);

//                     continue;
//                 }

//                 // Геокодирование (заглушка - реализуйте логику)
//                 // 4. Геокодирование (пример для Яндекс.Карт)

//                 // const geoResponse = await fetch(
//                 //     `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&format=json&geocode=${encodeURIComponent(
//                 //         row.Адрес
//                 //     )}`
//                 // );

//                 // const geoData = await geoResponse.json();

//                 // const [lng, lat] =
//                 //     geoData.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(
//                 //         ' '
//                 //     );
//                 const [lng, lat] = [0, 0];

//                 // UPSERT для delivery (inn + client)

//                 const [delivery] = await transaction('delivery')
//                     .insert({
//                         inn,

//                         client,
//                     })
//                     .onConflict(['inn', 'client'])
//                     .merge()
//                     .returning('id');

//                 // Вставка адреса
//                 await transaction('address_delivery').insert({
//                     delivery_id: delivery.id,
//                     address,
//                     date: formattedDate, // Теперь в формате YYYY-MM-DD
//                     latitude: lat,
//                     longitude: lng,
//                 });
//             } catch (error) {
//                 errors.push(`Строка ${index + 2}: ${error.message}`);
//             }
//         }

//         if (errors.length > 0) {
//             await transaction.rollback();

//             return res.status(400).json({
//                 success: false,

//                 message: `Обработано с ошибками (${
//                     rows.length - errors.length
//                 }/${rows.length})`,

//                 errors,
//             });
//         }

//         await transaction.commit();

//         res.status(201).json({
//             success: true,

//             message: `Успешно обработано ${rows.length} записей`,
//         });
//     } catch (error) {
//         await transaction.rollback();

//         console.error('Upload error:', error);

//         res.status(500).json({
//             error: 'Ошибка обработки файла',

//             details: error.message,
//         });
//     }
//     // finally {
//     //     // Очистка временного файла

//     //     if (req.file) fs.unlinkSync(req.file.path);
//     // }
// });

// 1.3.Эндпоинт для загрузки доставок из xlsx в бд
server.post('/api/upload-delivery', upload.single('file'), async (req, res) => {
    const errors = [];

    const transaction = await db.transaction();

    try {
        const workbook = XLSX.readFile(req.file.path, {
            cellDates: false,
            cellText: true,
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        for (const [index, row] of rows.entries()) {
            try {
                // Нормализация данных
                const inn = row.ИНН.toString().replace(/\.0$/, '').trim();
                const client = row.Клиент.toString().trim();
                const address = row['Адрес'].toString().trim();

                // Валидация обязательных полей
                if (!inn || !client || !address || !row['Дата']) {
                    errors.push(
                        `Строка ${index + 2}: Отсутствуют обязательные поля`
                    );
                    continue;
                }

                // Обработка даты
                let formattedDate;
                try {
                    formattedDate = formatDeliveryDate(row['Дата']);
                } catch (dateError) {
                    errors.push(`Строка ${index + 2}: ${dateError.message}`);
                    continue;
                }

                // Геокодирование (заглушка)
                const [lat, lng] = [0, 0];

                // UPSERT для delivery (inn + client)
                const [delivery] = await transaction('delivery')
                    .insert({ inn, client })
                    .onConflict(['inn', 'client'])
                    .merge()
                    .returning('id');

                // UPSERT для адреса с обновлением даты
                await transaction('address_delivery')
                    .insert({
                        delivery_id: delivery.id,
                        address,
                        date: formattedDate,
                        latitude: lat,
                        longitude: lng,
                    })

                    .onConflict(['delivery_id', 'address'])
                    .merge({
                        date: formattedDate,
                        latitude: lat,
                        longitude: lng,
                    });
            } catch (error) {
                errors.push(`Строка ${index + 2}: ${error.message}`);
            }
        }

        if (errors.length > 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: `Обработано с ошибками (${
                    rows.length - errors.length
                }/${rows.length})`,
                errors,
            });
        }

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: `Успешно обработано ${rows.length} записей`,
        });
    } catch (error) {
        await transaction.rollback();

        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Ошибка обработки файла',
            details: error.message,
        });
    }
    // finally {
    //     if (req.file) fs.unlinkSync(req.file.path);
    // }
});

// Эндпоинт для получения данных
server.get('/api/delivery', async (req, res) => {
    try {
        const deliveries = await db('delivery').select('*');

        const addresses = await db('address_delivery').select('*');

        const data = deliveries.map((delivery) => ({
            ...delivery,

            addresses: addresses.filter((a) => a.delivery_id === delivery.id),
        }));

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки данных доставок' });
    }
});

// Эндпоинт для удаления
server.delete('/api/delivery/:id', async (req, res) => {
    try {
        await db('delivery').where({ id: req.params.id }).del();

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete error:', error);

        res.status(500).json({ error: 'Ошибка удаления доставки' });
    }
});

// Эндпоинт для полной очистки данных в delivery
server.delete('/api/delivery-all', async (req, res) => {
    try {
        await db.transaction(async (trx) => {
            // Удаление всех адресов доставки

            await trx('address_delivery').del();

            // Удаление всех доставок

            const deletedCount = await trx('delivery').del();

            res.status(200).json({
                success: true,

                deleted_deliveries: deletedCount,
            });
        });
    } catch (error) {
        console.error('Delete all error:', error);

        res.status(500).json({
            success: false,

            error: 'Ошибка удаления данных',

            details: error.message,
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
