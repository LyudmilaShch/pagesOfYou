export interface HomeStep {
  number: string
  title: string
  description: string
}

export interface HomeExample {
  id: string
  title: string
  category: string
  cover: 'friend' | 'partner' | 'love-story' | 'mom' | 'parents'
  image?: string
  images?: string[]
  featured?: boolean
}

export interface HomeGallerySlot {
  exampleId: HomeExample['id']
  image: string
}

export interface HomeGalleryColumn {
  id: string
  topRatio: number
  bottomRatio: number
  slots: [HomeGallerySlot, HomeGallerySlot]
}

export interface HomeBenefit {
  icon: string
  title: string
  description: string
}

export interface HomeReview {
  id: string
  name: string
  role: string
  text: string
  initials: string
}

export interface HomeFaqItem {
  question: string
  answer: string
}

export const homeSteps: HomeStep[] = [
  {
    number: '01',
    title: 'Формат и наполнение',
    description: 'Определитесь с количеством страниц и тематическими блоками, которые войдут в журнал.',
  },
  {
    number: '02',
    title: 'Поделитесь материалами',
    description: 'Отправьте фотографии, истории, воспоминания, цитаты и пожелания — всё, что должно войти в будущий журнал.',
  },
  {
    number: '03',
    title: 'Согласуйте макет',
    description: 'Мы создадим индивидуальный дизайн журнала и отправим вам макет на проверку. Вы сможете внести правки и утвердить финальную версию перед печатью.',
  },
  {
    number: '04',
    title: 'Получите журнал',
    description: 'После согласования мы напечатаем журнал, бережно упакуем его и отправим в любой город или передадим лично.',
  },
]

export const homeExamples: HomeExample[] = [
  {
    id: 'love-story',
    title: 'История любви',
    category: 'Love Story',
    cover: 'love-story',
    image: '/images/examples/love.jpg',
    images: ['/images/examples/love.jpg'],
  },
  {
    id: 'partner',
    title: 'Журнал парню/мужу',
    category: 'Любовь',
    cover: 'partner',
    image: '/images/examples/mush.jpg',
    images: [
      '/images/examples/mush.jpg',
      '/images/examples/mish2.jpg',
      '/images/examples/mush3.jpg',
    ],
  },
  {
    id: 'friend',
    title: 'Журнал подруге',
    category: 'Дружба',
    cover: 'friend',
    image: '/images/examples/girl.jpg',
    images: [
      '/images/examples/girl.jpg',
      '/images/examples/girl2.jpg',
      '/images/examples/girl3.jpg',
    ],
    featured: true,
  },
  {
    id: 'mom',
    title: 'Журнал маме',
    category: 'Семья',
    cover: 'mom',
    image: '/images/examples/mother.jpg',
    images: ['/images/examples/mother.jpg', '/images/examples/mother2.jpg'],
  },
  {
    id: 'parents',
    title: 'Журнал родителям',
    category: 'Семейная история',
    cover: 'parents',
    image: '/images/examples/family.jpg',
    images: ['/images/examples/family.jpg'],
  },
]

export const homeGalleryColumns: HomeGalleryColumn[] = [
  {
    id: 'col-partner',
    topRatio: 2,
    bottomRatio: 1,
    slots: [
      { exampleId: 'partner', image: '/images/examples/mush.jpg' },
      { exampleId: 'love-story', image: '/images/examples/love.jpg' },
    ],
  },
  {
    id: 'col-friend',
    topRatio: 9,
    bottomRatio: 11,
    slots: [
      { exampleId: 'friend', image: '/images/examples/girl2.jpg' },
      { exampleId: 'mom', image: '/images/examples/mother.jpg' },
    ],
  },
  {
    id: 'col-love',
    topRatio: 3,
    bottomRatio: 2,
    slots: [
      { exampleId: 'friend', image: '/images/examples/girl.jpg' },
      { exampleId: 'partner', image: '/images/examples/mush3.jpg' },
    ],
  },
  {
    id: 'col-mom',
    topRatio: 9,
    bottomRatio: 11,
    slots: [
      { exampleId: 'partner', image: '/images/examples/mush2.jpg' },
      { exampleId: 'mom', image: '/images/examples/mother2.jpg' },
    ],
  },
  {
    id: 'col-parents',
    topRatio: 7,
    bottomRatio: 13,
    slots: [
      { exampleId: 'parents', image: '/images/examples/family.jpg' },
      { exampleId: 'friend', image: '/images/examples/girl3.jpg' },
    ],
  },
]

export const homeBenefits: HomeBenefit[] = [
  {
    icon: 'mdi-palette-outline',
    title: 'Премиальный дизайн',
    description: 'Редакционная верстка, продуманная типографика и спокойная цветовая палитра — как в настоящем журнале.',
  },
  {
    icon: 'mdi-printer-outline',
    title: 'Высокое качество печати',
    description: 'Плотная бумага, точная цветопередача и аккуратная обложка, приятная на ощупь.',
  },
  {
    icon: 'mdi-clock-outline',
    title: 'Простой процесс создания',
    description: 'Понятный формат сборки журнала позволяет легко подготовить материалы без навыков дизайна.',
  },
  {
    icon: 'mdi-truck-outline',
    title: 'Доставка по всей стране',
    description: 'Надёжная упаковка и доставка в любой город — журнал доедет в целости и сохранности.',
  },
]

export const homeReviews: HomeReview[] = [
  {
    id: '1',
    name: 'Виолетта',
    role: 'Заказала журнал для подруги',
    text: 'Просто чудесная работа! Всё выполнено очень красиво, аккуратно и с большим вниманием к деталям. Результат превзошёл ожидания - видно, что сделано с душой и профессионализмом. Спасибо за быструю, качественную работу и за такой прекрасный итог!',
    initials: 'В',
  },
  {
    id: '2',
    name: 'Екатерина',
    role: 'Подарила журнал маме',
    text: 'Доброго дня 🥺 хотела вас поблагодарить от всей души , за вашу работу , вы дарите такие впечатления , такие эмоции , именинник остался в восторге , когда читали вместе плакали . ❤️',
    initials: 'Е',
  },
  {
    id: '3',
    name: 'Mariia',
    role: 'Заказала журнал для подруги',
    text: 'безумно благодарна за журнал! дарила подруге и та плакала от счастья, когда его увидела. списались, договорились, не было никаких проблем со сроками или правками! спасибо огромное еще раз!!🌺✨',
    initials: 'M',
  },
]

export const homeFaqItems: HomeFaqItem[] = [
  {
    question: 'Что такое индивидуальный журнал?',
    answer:
      'Это персональный печатный журнал, созданный на основе вашей истории: фото, тексты, даты, цитаты, воспоминания и визуальный стиль. Он полностью посвящён одному человеку и может быть оформлен как подарок или личный проект.'},
  {
    question: 'Сколько времени занимает создание журнала?',
    answer:
      'В среднем макет готовится около 5 дней после того, как мы получаем все материалы. После утверждения печать занимает примерно 3 дня. Если журнал нужен срочно, мы можем ускорить процесс за дополнительную оплату.'
    },
  {
    question: 'Можно ли вносить правки?',
    answer:
      'Да, перед финальной печатью вы можете вносить правки. В базовый процесс входит до 10 бесплатных изменений, дополнительные правки оплачиваются отдельно. При этом любые ошибки с нашей стороны всегда исправляются бесплатно.',
  },
  {
    question: 'Сколько стоит доставка?',
    answer:
      'Стоимость доставки рассчитывается при оформлении заказа в зависимости от вашего города. Мы упаковываем журнал так, чтобы он доехал без повреждений.',
  },
  {
    question: 'Можно ли заказать несколько экземпляров?',
    answer:
      'Конечно. После создания макета вы можете заказать один или несколько экземпляров — удобно для подарков родным и близким.',
  },
  {
    question: 'В каком формате я получу журнал?',
    answer:
      'Вы получаете готовый печатный журнал высокого качества. При необходимости также можно получить цифровую версию в формате PDF.'
  },
]
