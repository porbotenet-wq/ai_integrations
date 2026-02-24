export interface WorkTemplate {
  number: number;
  name: string;
  unit: string;
  section: string;
  subsection: string;
  category: "nvf" | "spk" | "module" | "structural" | "spider" | "interior" | "additional";
}

export const workTypesTemplate: WorkTemplate[] = [
  // 1. НВФ
  // 1.1 Подготовительные работы
  { number: 1, name: "Геодезическая съёмка фасада", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 2, name: "Разработка ППР", unit: "компл.", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 3, name: "Вынос осей и разметка на фасаде", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 4, name: "Монтаж средств подмащивания (леса, подъёмники)", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 5, name: "Подготовка монтажного основания", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 6, name: "Очистка стен от загрязнений", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 7, name: "Демонтаж старой отделки", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  { number: 8, name: "Локальный ремонт монтажного основания", unit: "м2", section: "НВФ", subsection: "Подготовительные работы", category: "nvf" },
  // 1.2 Монтаж подконструкции
  { number: 9, name: "Разметка под установку кронштейнов", unit: "м2", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 10, name: "Испытание анкеров на вырыв", unit: "шт.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 11, name: "Бурение отверстий под анкеры", unit: "шт.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 12, name: "Установка несущих кронштейнов", unit: "шт.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 13, name: "Установка опорных кронштейнов", unit: "шт.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 14, name: "Установка паронитовых прокладок", unit: "шт.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 15, name: "Монтаж вертикальных направляющих профилей", unit: "м.п.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 16, name: "Монтаж горизонтальных направляющих профилей", unit: "м.п.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 17, name: "Монтаж противопожарных отсечек", unit: "м.п.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  { number: 18, name: "Устройство термокомпенсационных швов", unit: "м.п.", section: "НВФ", subsection: "Монтаж подконструкции", category: "nvf" },
  // 1.3 Утепление
  { number: 19, name: "Монтаж утеплителя (первый слой)", unit: "м2", section: "НВФ", subsection: "Утепление", category: "nvf" },
  { number: 20, name: "Монтаж утеплителя (второй слой)", unit: "м2", section: "НВФ", subsection: "Утепление", category: "nvf" },
  { number: 21, name: "Крепление утеплителя тарельчатыми дюбелями", unit: "шт.", section: "НВФ", subsection: "Утепление", category: "nvf" },
  { number: 22, name: "Монтаж ветро-влагозащитной мембраны", unit: "м2", section: "НВФ", subsection: "Утепление", category: "nvf" },
  { number: 23, name: "Устройство пароизоляции", unit: "м2", section: "НВФ", subsection: "Утепление", category: "nvf" },
  // 1.4 Облицовка
  { number: 24, name: "Облицовка керамогранитными плитами", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 25, name: "Облицовка композитными панелями (АКП)", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 26, name: "Облицовка перфорированными композитными панелями", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 27, name: "Облицовка фиброцементными плитами", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 28, name: "Облицовка металлокассетами", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 29, name: "Облицовка линеарными панелями", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 30, name: "Облицовка терракотовыми панелями", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 31, name: "Облицовка натуральным камнем", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 32, name: "Облицовка HPL-панелями", unit: "м2", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  { number: 33, name: "Монтаж декоративных ламелей", unit: "м.п.", section: "НВФ", subsection: "Облицовка", category: "nvf" },
  // 1.5 Примыкания и завершающие
  { number: 34, name: "Монтаж оконных откосов", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 35, name: "Монтаж дверных откосов", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 36, name: "Монтаж отливов", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 37, name: "Монтаж парапетных крышек", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 38, name: "Устройство примыканий к кровле", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 39, name: "Устройство примыканий к цоколю", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 40, name: "Монтаж угловых элементов", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 41, name: "Герметизация швов и стыков", unit: "м.п.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 42, name: "Демонтаж средств подмащивания", unit: "м2", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },
  { number: 43, name: "Уборка строительного мусора", unit: "компл.", section: "НВФ", subsection: "Примыкания и завершение", category: "nvf" },

  // 2. СПК - Стоечно-ригельная система
  { number: 44, name: "Геодезическая съёмка фасада", unit: "м2", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 45, name: "Разработка рабочей документации", unit: "компл.", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 46, name: "Вынос осей под СПК + разметка", unit: "м2", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 47, name: "Монтаж средств подмащивания", unit: "м2", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 48, name: "Подготовка проёмов и монтажного основания", unit: "м2", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 49, name: "Демонтаж старого остекления", unit: "м2", section: "СПК", subsection: "Подготовительные работы", category: "spk" },
  { number: 50, name: "Установка закладных элементов", unit: "шт.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 51, name: "Монтаж кронштейнов крепления СПК", unit: "шт.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 52, name: "Монтаж вертикальных стоек (импостов)", unit: "м.п.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 53, name: "Монтаж горизонтальных ригелей", unit: "м.п.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 54, name: "Сборка и монтаж каркаса (противопожарного)", unit: "м2", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 55, name: "Сборка и монтаж каркаса (не противопожарного)", unit: "м2", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 56, name: "Установка термомостов", unit: "шт.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 57, name: "Монтаж противопожарных коробов", unit: "м.п.", section: "СПК", subsection: "Монтаж несущего каркаса", category: "spk" },
  { number: 58, name: "Монтаж утепления непрозрачной зоны", unit: "м2", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 59, name: "Монтаж стеклопакетов (прозрачная зона)", unit: "м2", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 60, name: "Монтаж заполнения эмалит", unit: "м2", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 61, name: "Монтаж триплекса", unit: "м2", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 62, name: "Установка штапиков", unit: "м.п.", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 63, name: "Установка уплотнителей EPDM", unit: "м.п.", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 64, name: "Монтаж декоративных крышек", unit: "м.п.", section: "СПК", subsection: "Заполнение и остекление", category: "spk" },
  { number: 65, name: "Герметизация структурного шва", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 66, name: "Герметизация наружных швов", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 67, name: "Установка примыканий к стенам", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 68, name: "Установка примыканий к кровле", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 69, name: "Монтаж отливов", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 70, name: "Монтаж откосов", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 71, name: "Устройство пароизоляции монтажного шва", unit: "м.п.", section: "СПК", subsection: "Герметизация и примыкания", category: "spk" },
  { number: 72, name: "Монтаж алюминиевых окон", unit: "шт.", section: "СПК", subsection: "Окна и двери", category: "spk" },
  { number: 73, name: "Монтаж алюминиевых дверей", unit: "шт.", section: "СПК", subsection: "Окна и двери", category: "spk" },
  { number: 74, name: "Монтаж противопожарных дверей", unit: "шт.", section: "СПК", subsection: "Окна и двери", category: "spk" },
  { number: 75, name: "Установка фурнитуры", unit: "компл.", section: "СПК", subsection: "Окна и двери", category: "spk" },
  { number: 76, name: "Регулировка открывающихся элементов", unit: "шт.", section: "СПК", subsection: "Окна и двери", category: "spk" },

  // 3. Модульное остекление
  { number: 77, name: "Геодезическая съёмка фасада", unit: "м2", section: "Модульное остекление", subsection: "Подготовительные работы", category: "module" },
  { number: 78, name: "Разработка проектной документации", unit: "компл.", section: "Модульное остекление", subsection: "Подготовительные работы", category: "module" },
  { number: 79, name: "Вынос осей и разметка", unit: "м2", section: "Модульное остекление", subsection: "Подготовительные работы", category: "module" },
  { number: 80, name: "Подготовка монтажных проёмов", unit: "м2", section: "Модульное остекление", subsection: "Подготовительные работы", category: "module" },
  { number: 81, name: "Монтаж средств подмащивания", unit: "м2", section: "Модульное остекление", subsection: "Подготовительные работы", category: "module" },
  { number: 82, name: "Установка закладных элементов в перекрытия", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж крепёжной системы", category: "module" },
  { number: 83, name: "Монтаж кронштейнов крепления модулей", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж крепёжной системы", category: "module" },
  { number: 84, name: "Установка направляющих для модулей", unit: "м.п.", section: "Модульное остекление", subsection: "Монтаж крепёжной системы", category: "module" },
  { number: 85, name: "Монтаж противопожарных отсечек", unit: "м.п.", section: "Модульное остекление", subsection: "Монтаж крепёжной системы", category: "module" },
  { number: 86, name: "Подъём модулей на этаж", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж модулей", category: "module" },
  { number: 87, name: "Установка модулей в проектное положение", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж модулей", category: "module" },
  { number: 88, name: "Крепление модулей к несущим конструкциям", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж модулей", category: "module" },
  { number: 89, name: "Стыковка модулей между собой", unit: "м.п.", section: "Модульное остекление", subsection: "Монтаж модулей", category: "module" },
  { number: 90, name: "Регулировка положения модулей", unit: "шт.", section: "Модульное остекление", subsection: "Монтаж модулей", category: "module" },
  { number: 91, name: "Герметизация межмодульных швов", unit: "м.п.", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },
  { number: 92, name: "Герметизация примыканий к перекрытиям", unit: "м.п.", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },
  { number: 93, name: "Установка внутренних откосов", unit: "м.п.", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },
  { number: 94, name: "Монтаж подоконников", unit: "м.п.", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },
  { number: 95, name: "Регулировка открывающихся элементов", unit: "шт.", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },
  { number: 96, name: "Проверка герметичности", unit: "м2", section: "Модульное остекление", subsection: "Герметизация и завершение", category: "module" },

  // 4. Структурное остекление
  { number: 97, name: "Геодезическая съёмка фасада", unit: "м2", section: "Структурное остекление", subsection: "Подготовительные работы", category: "structural" },
  { number: 98, name: "Разработка проектной документации", unit: "компл.", section: "Структурное остекление", subsection: "Подготовительные работы", category: "structural" },
  { number: 99, name: "Вынос осей и разметка", unit: "м2", section: "Структурное остекление", subsection: "Подготовительные работы", category: "structural" },
  { number: 100, name: "Монтаж средств подмащивания", unit: "м2", section: "Структурное остекление", subsection: "Подготовительные работы", category: "structural" },
  { number: 101, name: "Установка закладных элементов", unit: "шт.", section: "Структурное остекление", subsection: "Монтаж несущего каркаса", category: "structural" },
  { number: 102, name: "Монтаж кронштейнов", unit: "шт.", section: "Структурное остекление", subsection: "Монтаж несущего каркаса", category: "structural" },
  { number: 103, name: "Монтаж вертикальных стоек", unit: "м.п.", section: "Структурное остекление", subsection: "Монтаж несущего каркаса", category: "structural" },
  { number: 104, name: "Монтаж горизонтальных ригелей", unit: "м.п.", section: "Структурное остекление", subsection: "Монтаж несущего каркаса", category: "structural" },
  { number: 105, name: "Установка термомостов", unit: "шт.", section: "Структурное остекление", subsection: "Монтаж несущего каркаса", category: "structural" },
  { number: 106, name: "Нанесение структурного герметика на стеклопакет", unit: "м2", section: "Структурное остекление", subsection: "Монтаж остекления", category: "structural" },
  { number: 107, name: "Установка стеклопакетов на каркас", unit: "м2", section: "Структурное остекление", subsection: "Монтаж остекления", category: "structural" },
  { number: 108, name: "Фиксация стеклопакетов прижимными планками", unit: "м.п.", section: "Структурное остекление", subsection: "Монтаж остекления", category: "structural" },
  { number: 109, name: "Герметизация структурных швов", unit: "м.п.", section: "Структурное остекление", subsection: "Монтаж остекления", category: "structural" },
  { number: 110, name: "Установка примыканий", unit: "м.п.", section: "Структурное остекление", subsection: "Завершающие работы", category: "structural" },
  { number: 111, name: "Монтаж отливов и откосов", unit: "м.п.", section: "Структурное остекление", subsection: "Завершающие работы", category: "structural" },
  { number: 112, name: "Очистка остекления", unit: "м2", section: "Структурное остекление", subsection: "Завершающие работы", category: "structural" },

  // 5. Спайдерное остекление
  { number: 113, name: "Геодезическая съёмка", unit: "м2", section: "Спайдерное остекление", subsection: "Подготовительные работы", category: "spider" },
  { number: 114, name: "Разработка проектной документации", unit: "компл.", section: "Спайдерное остекление", subsection: "Подготовительные работы", category: "spider" },
  { number: 115, name: "Разметка точек крепления", unit: "шт.", section: "Спайдерное остекление", subsection: "Подготовительные работы", category: "spider" },
  { number: 116, name: "Установка закладных элементов", unit: "шт.", section: "Спайдерное остекление", subsection: "Монтаж несущей системы", category: "spider" },
  { number: 117, name: "Монтаж несущих тросов/тяг", unit: "м.п.", section: "Спайдерное остекление", subsection: "Монтаж несущей системы", category: "spider" },
  { number: 118, name: "Монтаж несущих рёбер", unit: "м.п.", section: "Спайдерное остекление", subsection: "Монтаж несущей системы", category: "spider" },
  { number: 119, name: "Установка спайдеров (точечных креплений)", unit: "шт.", section: "Спайдерное остекление", subsection: "Монтаж несущей системы", category: "spider" },
  { number: 120, name: "Монтаж рутелей", unit: "шт.", section: "Спайдерное остекление", subsection: "Монтаж несущей системы", category: "spider" },
  { number: 121, name: "Установка стеклопакетов с отверстиями", unit: "м2", section: "Спайдерное остекление", subsection: "Монтаж остекления", category: "spider" },
  { number: 122, name: "Крепление стекла к спайдерам", unit: "шт.", section: "Спайдерное остекление", subsection: "Монтаж остекления", category: "spider" },
  { number: 123, name: "Герметизация швов между стёклами", unit: "м.п.", section: "Спайдерное остекление", subsection: "Монтаж остекления", category: "spider" },

  // 6. Внутренние СПК
  { number: 124, name: "Разметка и вынос осей", unit: "м2", section: "Внутренние СПК", subsection: "Подготовительные работы", category: "interior" },
  { number: 125, name: "Подготовка монтажного основания", unit: "м2", section: "Внутренние СПК", subsection: "Подготовительные работы", category: "interior" },
  { number: 126, name: "Монтаж направляющих профилей", unit: "м.п.", section: "Внутренние СПК", subsection: "Монтаж каркаса", category: "interior" },
  { number: 127, name: "Монтаж стоек и ригелей", unit: "м.п.", section: "Внутренние СПК", subsection: "Монтаж каркаса", category: "interior" },
  { number: 128, name: "Монтаж стеклопакетов", unit: "м2", section: "Внутренние СПК", subsection: "Остекление и отделка", category: "interior" },
  { number: 129, name: "Монтаж декоративных крышек", unit: "м.п.", section: "Внутренние СПК", subsection: "Остекление и отделка", category: "interior" },
  { number: 130, name: "Установка дверей", unit: "шт.", section: "Внутренние СПК", subsection: "Остекление и отделка", category: "interior" },
  { number: 131, name: "Установка окон", unit: "шт.", section: "Внутренние СПК", subsection: "Остекление и отделка", category: "interior" },
  { number: 132, name: "Установка примыканий, герметизация", unit: "м.п.", section: "Внутренние СПК", subsection: "Остекление и отделка", category: "interior" },

  // 7. Дополнительные работы
  { number: 133, name: "Монтаж алюминиевых окон", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 134, name: "Монтаж пластиковых окон", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 135, name: "Монтаж входных групп", unit: "компл.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 136, name: "Монтаж алюминиевых дверей", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 137, name: "Монтаж противопожарных дверей", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 138, name: "Монтаж автоматических дверей", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 139, name: "Монтаж вращающихся дверей", unit: "шт.", section: "Дополнительные работы", subsection: "Окна и двери наружного фасада", category: "additional" },
  { number: 140, name: "Монтаж солнцезащитных ламелей", unit: "м.п.", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 141, name: "Монтаж жалюзийных решёток", unit: "м2", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 142, name: "Монтаж вентиляционных решёток", unit: "шт.", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 143, name: "Установка люков дымоудаления", unit: "шт.", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 144, name: "Монтаж зенитных фонарей", unit: "м2", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 145, name: "Монтаж светопрозрачной кровли", unit: "м2", section: "Дополнительные работы", subsection: "Специальные элементы", category: "additional" },
  { number: 146, name: "Устройство противопожарных поясов", unit: "м.п.", section: "Дополнительные работы", subsection: "Противопожарные мероприятия", category: "additional" },
  { number: 147, name: "Монтаж противопожарного остекления", unit: "м2", section: "Дополнительные работы", subsection: "Противопожарные мероприятия", category: "additional" },
  { number: 148, name: "Огнезащитная обработка конструкций", unit: "м2", section: "Дополнительные работы", subsection: "Противопожарные мероприятия", category: "additional" },
];

// Get unique sections
export const workSections = [...new Set(workTypesTemplate.map(w => w.section))];

// Filter by work_type selection
export function getTemplatesByWorkType(workType: "nvf" | "spk" | "both"): WorkTemplate[] {
  if (workType === "nvf") return workTypesTemplate.filter(w => w.category === "nvf" || w.category === "additional");
  if (workType === "spk") return workTypesTemplate.filter(w => w.category !== "nvf");
  return workTypesTemplate; // both
}
