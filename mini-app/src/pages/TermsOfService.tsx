import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const TermsOfService = () => {
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
                Пользовательское соглашение
              </h1>
              <p className="text-sm text-t3">
                Редакция от 19 февраля 2026 г.
              </p>
            </header>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">1. Предмет соглашения</h2>
              <p className="text-sm text-t2 leading-relaxed">
                1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует
                порядок использования системы управления строительными проектами «STSphera»
                (далее — «Система»), включая веб-интерфейс и Telegram Mini App,
                предоставляемой ООО «СФЕРА» (ИНН 1660339627, ОГРН 1191690106618,
                далее — «Правообладатель»).
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                1.2. Настоящее Соглашение является публичной офертой в соответствии
                со ст. 437 ГК РФ. Использование Системы означает полное и безоговорочное
                принятие (акцепт) условий настоящего Соглашения.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">2. Описание Системы</h2>
              <p className="text-sm text-t2 leading-relaxed">
                2.1. Система «STSphera» предназначена для:
              </p>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Управления фасадными и строительными проектами;</li>
                <li>Учёта план/факт выполненных работ;</li>
                <li>Контроля поставок материалов и логистики;</li>
                <li>Управления бригадами и персоналом;</li>
                <li>Формирования отчётности и аналитики;</li>
                <li>Согласования документов и задач;</li>
                <li>Уведомления через Telegram-бота.</li>
              </ul>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                2.2. Система предоставляется как облачный сервис (SaaS) для корпоративных
                пользователей строительной отрасли.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">3. Права и обязанности Пользователя</h2>
              <p className="text-sm text-t2 leading-relaxed">3.1. Пользователь обязуется:</p>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Предоставлять достоверную информацию при регистрации;</li>
                <li>Не передавать учётные данные третьим лицам;</li>
                <li>Обеспечивать конфиденциальность PIN-кода и пароля;</li>
                <li>Использовать Систему только по назначению;</li>
                <li>Не предпринимать попыток несанкционированного доступа;</li>
                <li>Соблюдать требования законодательства РФ при использовании Системы.</li>
              </ul>
              <p className="text-sm text-t2 leading-relaxed mt-2">3.2. Пользователь имеет право:</p>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Использовать функциональность Системы в соответствии со своей ролью;</li>
                <li>Обращаться в службу поддержки;</li>
                <li>Отозвать согласие на обработку персональных данных;</li>
                <li>Запрашивать удаление своего аккаунта.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">4. Права и обязанности Правообладателя</h2>
              <p className="text-sm text-t2 leading-relaxed">4.1. Правообладатель обязуется:</p>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Обеспечивать работоспособность Системы;</li>
                <li>Защищать персональные данные в соответствии с 152-ФЗ;</li>
                <li>Уведомлять Пользователей об изменениях в настоящем Соглашении;</li>
                <li>Обеспечивать техническую поддержку.</li>
              </ul>
              <p className="text-sm text-t2 leading-relaxed mt-2">4.2. Правообладатель имеет право:</p>
              <ul className="list-disc list-inside text-sm text-t2 mt-2 space-y-1">
                <li>Вносить изменения в функциональность Системы;</li>
                <li>Приостанавливать доступ при нарушении условий Соглашения;</li>
                <li>Проводить плановые технические работы с предварительным уведомлением.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">5. Интеллектуальная собственность</h2>
              <p className="text-sm text-t2 leading-relaxed">
                5.1. Система «STSphera», включая программный код, дизайн, интерфейс,
                базы данных и документацию, является интеллектуальной собственностью ООО «СФЕРА».
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                5.2. Пользователю предоставляется неисключительное, непередаваемое право
                использования Системы в рамках предоставленной роли.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">6. Ограничение ответственности</h2>
              <p className="text-sm text-t2 leading-relaxed">
                6.1. Система предоставляется «как есть» (as is). Правообладатель не гарантирует
                бесперебойную работу в случаях, не зависящих от Правообладателя.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                6.2. Правообладатель не несёт ответственности за убытки, вызванные
                ненадлежащим использованием Системы Пользователем.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                6.3. Совокупная ответственность Правообладателя ограничена суммой,
                уплаченной Пользователем за использование Системы за последние 12 месяцев.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">7. Использование Telegram Mini App</h2>
              <p className="text-sm text-t2 leading-relaxed">
                7.1. При использовании Системы через Telegram Mini App Пользователь
                дополнительно соглашается с условиями использования платформы Telegram.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                7.2. Telegram-бот может отправлять уведомления о событиях Системы.
                Управление уведомлениями доступно в настройках профиля.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                7.3. Правообладатель не несёт ответственности за работоспособность
                платформы Telegram и её сервисов.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">8. Порядок разрешения споров</h2>
              <p className="text-sm text-t2 leading-relaxed">
                8.1. Все споры разрешаются путём переговоров. При невозможности
                достижения согласия споры подлежат рассмотрению Арбитражным судом
                Республики Татарстан.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                8.2. К настоящему Соглашению применяется законодательство Российской Федерации.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">9. Заключительные положения</h2>
              <p className="text-sm text-t2 leading-relaxed">
                9.1. Настоящее Соглашение вступает в силу с момента акцепта и действует
                в течение всего срока использования Системы.
              </p>
              <p className="text-sm text-t2 leading-relaxed mt-2">
                9.2. Правообладатель вправе в одностороннем порядке изменять условия
                Соглашения, уведомив Пользователей через Систему не менее чем за 10 дней.
              </p>
            </section>

            <section className="bg-bg1 rounded-lg p-4 border border-border">
              <h2 className="text-lg font-bold text-foreground mb-2">Реквизиты Правообладателя</h2>
              <div className="text-sm text-t2 space-y-1">
                <p><span className="text-t3">Наименование:</span> ООО «СФЕРА»</p>
                <p><span className="text-t3">Генеральный директор:</span> Нигматуллин Артур Альбертович</p>
                <p><span className="text-t3">ИНН:</span> 1660339627 / КПП: 166001001</p>
                <p><span className="text-t3">ОГРН:</span> 1191690106618</p>
                <p><span className="text-t3">Юр. адрес:</span> 420087, Республика Татарстан, г. Казань, ул. Аделя Кутуя, д. 86 корп. 3, оф. 1</p>
                <p><span className="text-t3">Р/с:</span> 40702810002500062202 в ООО «Банк Точка»</p>
                <p><span className="text-t3">К/с:</span> 30101810745374525104</p>
                <p><span className="text-t3">БИК:</span> 044525104</p>
                <p><span className="text-t3">Email:</span> info@gkpanorama.com</p>
                <p><span className="text-t3">Телефон:</span> 8 (960) 057-20-31</p>
              </div>
            </section>

            <footer className="pt-6 border-t border-border">
              <div className="flex flex-wrap gap-4 text-xs text-primary mb-4">
                <Link to="/privacy" className="hover:underline">Политика конфиденциальности</Link>
                <Link to="/consent" className="hover:underline">Согласие на обработку ПД</Link>
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

export default TermsOfService;
