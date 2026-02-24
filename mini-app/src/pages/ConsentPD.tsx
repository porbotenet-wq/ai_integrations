import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const ConsentPD = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-t2 hover:text-primary transition-colors mb-6"
        >
          ← Назад
        </Link>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <article className="prose prose-invert max-w-none space-y-6 pb-12">
            <header className="mb-8">
              <div className="font-mono text-xs tracking-[0.3em] text-primary mb-2">
                PANORAMA GROUP · СФЕРА
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-1">
                Согласие на обработку персональных данных
              </h1>
              <p className="text-sm text-t3">
                Отдельный документ согласно ч. 8 ст. 9 Федерального закона № 152-ФЗ
                (в ред. от 01.09.2025)
              </p>
            </header>

            <section>
              <p className="text-sm text-t2 leading-relaxed">
                Я, Пользователь системы «STSphera» (далее — Система), включая Telegram Mini App,
                действуя свободно, своей волей и в своём интересе, даю ООО «СФЕРА»
                (ИНН 1660339627, ОГРН 1191690106618, 420087, Республика Татарстан, г. Казань,
                ул. Аделя Кутуя, д. 86 корп. 3, оф. 1) (далее — Оператор) согласие
                на обработку моих персональных данных на следующих условиях:
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">1. Перечень персональных данных</h2>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Фамилия, имя, отчество;</li>
                <li>Должность;</li>
                <li>Номер телефона, адрес электронной почты;</li>
                <li>Идентификатор Telegram (chat_id, username);</li>
                <li>Роль в Системе;</li>
                <li>PIN-код (в хешированном виде);</li>
                <li>Фотоматериалы, загружаемые в Систему;</li>
                <li>Данные об активности в Системе (журналы действий, временные метки);</li>
                <li>Геолокация (при наличии отдельного согласия).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">2. Цели обработки</h2>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Идентификация и аутентификация в Системе;</li>
                <li>Управление строительными проектами, распределение задач;</li>
                <li>Учёт персонала и бригад;</li>
                <li>Формирование отчётности план/факт;</li>
                <li>Контроль поставок материалов;</li>
                <li>Отправка уведомлений через Telegram-бота;</li>
                <li>Обеспечение безопасности и контроля доступа;</li>
                <li>Улучшение функциональности Системы.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">3. Способы обработки</h2>
              <p className="text-sm text-t2 leading-relaxed">
                Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение),
                извлечение, использование, передача (предоставление, доступ), обезличивание,
                блокирование, удаление, уничтожение — автоматизированным способом
                с использованием средств вычислительной техники.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">4. Срок действия согласия</h2>
              <p className="text-sm text-t2 leading-relaxed">
                Согласие действует в течение всего срока использования Системы и 3 (трёх) лет
                после прекращения использования, если иное не предусмотрено
                законодательством РФ.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">5. Порядок отзыва согласия</h2>
              <p className="text-sm text-t2 leading-relaxed">
                5.1. Согласие может быть отозвано в любое время путём направления письменного
                заявления Оператору по адресу: info@gkpanorama.com или по почтовому адресу:
                420015, Республика Татарстан, г. Казань, ул. Касаткина, д. 15.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                5.2. В случае отзыва согласия Оператор прекращает обработку персональных данных
                и уничтожает их в срок не позднее 30 дней с даты получения отзыва,
                за исключением случаев, когда обработка может быть продолжена
                в соответствии с законодательством РФ.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">6. Лица, осуществляющие обработку</h2>
              <p className="text-sm text-t2 leading-relaxed">
                Обработка персональных данных осуществляется ООО «СФЕРА» и уполномоченными
                лицами Оператора. Персональные данные не передаются третьим лицам
                без отдельного согласия субъекта, за исключением случаев, предусмотренных
                законодательством РФ.
              </p>
            </section>

            <section className="bg-bg1 rounded-lg p-4 border border-border">
              <h2 className="text-lg font-bold text-foreground mb-2">Оператор</h2>
              <div className="text-sm text-t2 space-y-1">
                <p><span className="text-t3">Наименование:</span> ООО «СФЕРА»</p>
                <p><span className="text-t3">ИНН:</span> 1660339627 / КПП: 166001001</p>
                <p><span className="text-t3">ОГРН:</span> 1191690106618</p>
                <p><span className="text-t3">Адрес:</span> 420087, Республика Татарстан, г. Казань, ул. Аделя Кутуя, д. 86 корп. 3, оф. 1</p>
                <p><span className="text-t3">Генеральный директор:</span> Нигматуллин Артур Альбертович</p>
                <p><span className="text-t3">Email:</span> info@gkpanorama.com</p>
                <p><span className="text-t3">Телефон:</span> 8 (960) 057-20-31</p>
              </div>
            </section>

            <footer className="pt-6 border-t border-border">
              <div className="flex flex-wrap gap-4 text-xs text-primary mb-4">
                <Link to="/privacy" className="hover:underline">Политика конфиденциальности</Link>
                <Link to="/terms" className="hover:underline">Пользовательское соглашение</Link>
              </div>
              <p className="text-xs text-t3">
                © 2026 ООО «СФЕРА» (PANORAMA GROUP). Все права защищены.
              </p>
            </footer>
          </article>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ConsentPD;
