export interface GameCharacter {
  id: string;
  name: string;
  role: 'General' | 'Governor' | 'Lady';
  element: 'Fire' | 'Earth' | 'Metal' | 'Water' | 'Wood';
  price: number; // Recruit cost in Coins
  affinity: 'Shu' | 'Wei' | 'Wu' | 'Neutral';
  modifierDesc: string;
  effect: (town: any) => void;
}

export const THREE_KINGDOMS_ROSTER: GameCharacter[] = [
  // --- SHU HAN ---
  {
    id: 'char_liubei',
    name: 'Liu Bei (Grand Commander)',
    role: 'General',
    element: 'Earth',
    price: 100,
    affinity: 'Shu',
    modifierDesc: '+20% Morale and -10% Poverty Rate decay.',
    effect: (town) => { town.morale = Math.min(100, (town.morale || 100) + 20); }
  },
  {
    id: 'char_guanyu',
    name: 'Guan Yu (God of War)',
    role: 'General',
    element: 'Fire',
    price: 120,
    affinity: 'Shu',
    modifierDesc: '+25% suppression power against rebel forces.',
    effect: () => {}
  },
  {
    id: 'char_zhangfei',
    name: 'Zhang Fei (Wood General)',
    role: 'General',
    element: 'Wood',
    price: 110,
    affinity: 'Shu',
    modifierDesc: '+20% threat reduction from incoming bandit raids.',
    effect: () => {}
  },
  {
    id: 'char_zhaoyun',
    name: 'Zhao Yun (Dragon General)',
    role: 'General',
    element: 'Metal',
    price: 115,
    affinity: 'Shu',
    modifierDesc: '+15% army defensive strength.',
    effect: () => {}
  },
  {
    id: 'char_machao',
    name: 'Ma Chao (The Splendid)',
    role: 'General',
    element: 'Fire',
    price: 105,
    affinity: 'Shu',
    modifierDesc: '+10% Cavalry unit damage.',
    effect: () => {}
  },
  {
    id: 'char_huangzhong',
    name: 'Huang Zhong (Grand Archer)',
    role: 'General',
    element: 'Wood',
    price: 90,
    affinity: 'Shu',
    modifierDesc: '+15% Archer unit damage.',
    effect: () => {}
  },
  {
    id: 'char_zhugeliang',
    name: 'Zhuge Liang (Sleeping Dragon)',
    role: 'Governor',
    element: 'Water',
    price: 140,
    affinity: 'Shu',
    modifierDesc: '+25% research progression speed.',
    effect: () => {}
  },
  {
    id: 'char_pangtong',
    name: 'Pang Tong (Fledgling Phoenix)',
    role: 'Governor',
    element: 'Water',
    price: 110,
    affinity: 'Shu',
    modifierDesc: '+15% research speed and -5% construction cost.',
    effect: () => {}
  },
  {
    id: 'char_fazheng',
    name: 'Fa Zheng (Tactician)',
    role: 'Governor',
    element: 'Water',
    price: 95,
    affinity: 'Shu',
    modifierDesc: '+10% passive tax income from peasants.',
    effect: () => {}
  },

  // --- CAO WEI ---
  {
    id: 'char_caocao',
    name: 'Cao Cao (Hero of Chaos)',
    role: 'General',
    element: 'Earth',
    price: 120,
    affinity: 'Wei',
    modifierDesc: '+20% Public Order and -15% Corruption.',
    effect: (town) => { town.publicOrder = Math.min(100, (town.publicOrder || 100) + 20); }
  },
  {
    id: 'char_xiahoudun',
    name: 'Xiahou Dun (One-Eyed General)',
    role: 'General',
    element: 'Wood',
    price: 110,
    affinity: 'Wei',
    modifierDesc: '+15% military morale and +5% defensive wall strength.',
    effect: () => {}
  },
  {
    id: 'char_xiahouyuan',
    name: 'Xiahou Yuan (Cavalry General)',
    role: 'General',
    element: 'Fire',
    price: 100,
    affinity: 'Wei',
    modifierDesc: '+15% Cavalry speed and travel time reduction.',
    effect: () => {}
  },
  {
    id: 'char_xuchu',
    name: 'Xu Chu (Tiger Tiger)',
    role: 'General',
    element: 'Earth',
    price: 95,
    affinity: 'Wei',
    modifierDesc: '+10% infantry armor retention rate.',
    effect: () => {}
  },
  {
    id: 'char_dianwei',
    name: 'Dian Wei (The Stout Guard)',
    role: 'General',
    element: 'Metal',
    price: 95,
    affinity: 'Wei',
    modifierDesc: '+12% general bodyguard defense.',
    effect: () => {}
  },
  {
    id: 'char_simayi',
    name: 'Sima Yi (Withered Water)',
    role: 'Governor',
    element: 'Water',
    price: 135,
    affinity: 'Wei',
    modifierDesc: '+20% technology efficiency and +15% espionage success.',
    effect: () => {}
  },
  {
    id: 'char_guojia',
    name: 'Guo Jia (Strategic Genius)',
    role: 'Governor',
    element: 'Water',
    price: 115,
    affinity: 'Wei',
    modifierDesc: '+15% crop production in cold winter.',
    effect: () => {}
  },
  {
    id: 'char_xunyu',
    name: 'Xun Yu (Master Administrator)',
    role: 'Governor',
    element: 'Water',
    price: 110,
    affinity: 'Wei',
    modifierDesc: '-10% building construction cost in towns.',
    effect: () => {}
  },

  // --- EASTERN WU ---
  {
    id: 'char_sunjian',
    name: 'Sun Jian (Tiger of Jiangdong)',
    role: 'General',
    element: 'Fire',
    price: 110,
    affinity: 'Wu',
    modifierDesc: '+15% infantry damage and +10% resource collection speed.',
    effect: () => {}
  },
  {
    id: 'char_sunce',
    name: 'Sun Ce (Little Conqueror)',
    role: 'General',
    element: 'Fire',
    price: 115,
    affinity: 'Wu',
    modifierDesc: '+20% Cavalry charge speed and +10% general damage.',
    effect: () => {}
  },
  {
    id: 'char_sunquan',
    name: 'Sun Quan (Wu Sovereign)',
    role: 'General',
    element: 'Earth',
    price: 110,
    affinity: 'Wu',
    modifierDesc: '+15% commercial harbor and marketplace income.',
    effect: () => {}
  },
  {
    id: 'char_ganning',
    name: 'Gan Ning (Brocade Pirate)',
    role: 'General',
    element: 'Fire',
    price: 100,
    affinity: 'Wu',
    modifierDesc: '+20% harbour trade rate and combat effectiveness.',
    effect: () => {}
  },
  {
    id: 'char_taishici',
    name: 'Taishi Ci (Peerless Bowman)',
    role: 'General',
    element: 'Metal',
    price: 100,
    affinity: 'Wu',
    modifierDesc: '+15% archery squad damage output.',
    effect: () => {}
  },
  {
    id: 'char_zhoutai',
    name: 'Zhou Tai (Unyielding shield)',
    role: 'General',
    element: 'Wood',
    price: 90,
    affinity: 'Wu',
    modifierDesc: '+10% infantry defensive shield health.',
    effect: () => {}
  },
  {
    id: 'char_zhouyu',
    name: 'Zhou Yu (Gorgeous Tactician)',
    role: 'Governor',
    element: 'Water',
    price: 130,
    affinity: 'Wu',
    modifierDesc: '+25% commercial revenue from inns and harbours.',
    effect: () => {}
  },
  {
    id: 'char_lusu',
    name: 'Lu Su (Generous Diplomat)',
    role: 'Governor',
    element: 'Water',
    price: 105,
    affinity: 'Wu',
    modifierDesc: '+15% trade negotiation yields and alliance morale.',
    effect: () => {}
  },
  {
    id: 'char_lumeng',
    name: 'Lu Meng (Scholarly General)',
    role: 'Governor',
    element: 'Water',
    price: 110,
    affinity: 'Wu',
    modifierDesc: '+10% technology progression and +10% military defense.',
    effect: () => {}
  },

  // --- LADIES & WIVES (ACCURATE ROMANCES) ---
  {
    id: 'char_diaochan',
    name: 'Diaochan (Apex Beauty)',
    role: 'Lady',
    element: 'Water',
    price: 85,
    affinity: 'Neutral',
    modifierDesc: '+15% Morale, reduces enemy rebel threat values.',
    effect: () => {}
  },
  {
    id: 'char_sunren',
    name: 'Sun Ren (Lady Sun - Archer princess)',
    role: 'Lady',
    element: 'Fire',
    price: 95,
    affinity: 'Wu',
    modifierDesc: '+15% general health and +10% Archer squad combat power.',
    effect: () => {}
  },
  {
    id: 'char_daqiao',
    name: 'Da Qiao (Sun Ce Wife)',
    role: 'Lady',
    element: 'Water',
    price: 80,
    affinity: 'Wu',
    modifierDesc: '+15% public happiness, increases town tax rate slightly.',
    effect: () => {}
  },
  {
    id: 'char_xiaoqiao',
    name: 'Xiao Qiao (Zhou Yu Wife)',
    role: 'Lady',
    element: 'Water',
    price: 80,
    affinity: 'Wu',
    modifierDesc: '+10% research progress and +10% commercial income.',
    effect: () => {}
  },
  {
    id: 'char_ladyzhen',
    name: 'Lady Zhen (Cao Pi Wife)',
    role: 'Lady',
    element: 'Metal',
    price: 75,
    affinity: 'Wei',
    modifierDesc: '+12% general satisfaction rate.',
    effect: () => {}
  },
  {
    id: 'char_ladybian',
    name: 'Lady Bian (Cao Cao Wife)',
    role: 'Lady',
    element: 'Earth',
    price: 70,
    affinity: 'Wei',
    modifierDesc: '+10% general family prestige boost.',
    effect: () => {}
  },
  {
    id: 'char_ladymi',
    name: 'Lady Mi (Liu Bei Wife)',
    role: 'Lady',
    element: 'Earth',
    price: 65,
    affinity: 'Shu',
    modifierDesc: '+10% food reserves retention and crop protection.',
    effect: () => {}
  },
  {
    id: 'char_ladygan',
    name: 'Lady Gan (Liu Bei Wife)',
    role: 'Lady',
    element: 'Wood',
    price: 65,
    affinity: 'Shu',
    modifierDesc: '+10% housing capacity, increases birth rate of children.',
    effect: () => {}
  },
  {
    id: 'char_ladywu',
    name: 'Lady Wu (Wu Dowager)',
    role: 'Lady',
    element: 'Earth',
    price: 75,
    affinity: 'Wu',
    modifierDesc: '+15% alliance strength and +10% prestige limits.',
    effect: () => {}
  },

  // --- NEUTRAL WARLORDS ---
  {
    id: 'char_lubu',
    name: 'Lu Bu (The Peerless Warrior)',
    role: 'General',
    element: 'Fire',
    price: 150,
    affinity: 'Neutral',
    modifierDesc: '+40% suppression rate and double suppression damage.',
    effect: () => {}
  },
  {
    id: 'char_dongzhuo',
    name: 'Dong Zhuo (The Tyrant)',
    role: 'General',
    element: 'Fire',
    price: 90,
    affinity: 'Neutral',
    modifierDesc: '+20% tax income but -10 Morale point decay.',
    effect: () => {}
  },
  {
    id: 'char_yuanshao',
    name: 'Yuan Shao (Alliance Leader)',
    role: 'General',
    element: 'Earth',
    price: 95,
    affinity: 'Neutral',
    modifierDesc: '+15% infantry recruitment cost reduction.',
    effect: () => {}
  },
  {
    id: 'char_gongsanzan',
    name: 'Gongsun Zan (Ironfist Cavalry)',
    role: 'General',
    element: 'Metal',
    price: 95,
    affinity: 'Neutral',
    modifierDesc: '+15% Cavalry defense, unlocks White Horse Raiders.',
    effect: () => {}
  }
];
