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
     }
    catch(err) { 
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

// Получение данных по ИНН

server.get('/delivery/get-by-inn', async (req, res) => {
    const { inn } = req.query;
    try {
        // Получаем основную информацию о доставке
        const delivery = await db('delivery')
            .where({ inn })
            .first()
            .select('id', 'inn', 'client');
        // console.log(delivery);
        if (!delivery) {
            return res.status(404).json({
                error: 'Данные не найдены для указанного ИНН'
            });
        }

        // Получаем связанные адреса доставки
        const addresses = delivery
            ? (await db('address_delivery')
                .where({ delivery_id: delivery.id })
                .select('address'))
            : [];

        // Формируем ответ
        res.json({
            inn: delivery.inn,
            addresses: addresses.map(a => a.address) || []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            inn,
            addresses: [] // всегда возвращать массив
            // error: 'Ошибка сервера при получении данных'
        });
    }
});

// Получение данных по массиву номеров для транспортных компаний

server.post('/tk/get-by-numbers', async (req, res) => {
    try {
        const { numbers } = req.body;
        // Валидация входных данных
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Неверный формат номеров' });
        }
        // Функция для нормализации номера
        // const normalizeNumber = (num) => num.replace(/[-+()\s]/g, '');
        function normalizeNumber(stringWithNumbers) {
            const str = stringWithNumbers.match(/(?:\+|\d)[\d\-\(\) ]{7,}\d/g);
            // const digits = str[0].replace(/\D/g, '');
            if (!str) return [];
            const res = [];
            str.forEach((num) => res.push(num.replace(/\D/g, '')));
            return res;
            // console.log(res);
        }

        // Поиск первого подходящего номера
        for (const num of numbers) {
            try {
                const normalized = normalizeNumber(num);
                const phoneRecord = await db('phones')
                    .whereRaw(
                        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), '(', ''), ')', '') = ?",
                        normalized
                    )
                    .first()
                    .select('branch_id');
                if (phoneRecord) {
                    // Дальнейшая логика обработки найденного номера

                    const branchInfo = await db('branches')
                        .where({ id: phoneRecord.branch_id })
                        .first()
                        .select('tk_id', 'address');
                    const tkInfo = await db('tk')
                        .where({ id: branchInfo.tk_id })
                        .first()
                        .select('name');
                    const allBranches = await db('branches')
                        .where({ tk_id: branchInfo.tk_id })
                        .select('address');
                    return res.json({
                        company: tkInfo.name,
                        branches: allBranches.map((b) => b.address),
                    });
                }
            } catch (err) {
                console.error(`Ошибка обработки номера ${num}:`, err);
                // Продолжаем проверять следующие номера
            }
        }

        // Если ни один номер не найден
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

module.exports = server;
