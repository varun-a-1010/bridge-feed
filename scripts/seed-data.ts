import type { EntityType, Stance } from '../shared/model';

/** Sample posts by fictional authors. The expected stance is only used to audit the classifier. */
export const SEEDS: { author: string; expected: Stance; text: string }[] = [
  {
    author: 'Maya R.',
    expected: 'ai_skeptical',
    text: 'Rewatched Blade Runner this weekend and all I could think about was how every frame was drawn, argued over and lit by someone who cared. I do not want studios swapping concept artists for prompts.',
  },
  {
    author: 'Tomás V.',
    expected: 'ai_skeptical',
    text: 'Spirited Away took years because a whole team fought over how a bath house should feel. A model can copy that palette, but it cannot want anything. That is the part of art I refuse to give up.',
  },
  {
    author: 'Priya N.',
    expected: 'ai_skeptical',
    text: 'Bought the new Bon Iver record on vinyl. If a label ever slips AI vocals onto something I love, I am done with them. The human crack in a voice is the whole point.',
  },
  {
    author: 'Hannah L.',
    expected: 'ai_skeptical',
    text: 'Klara and the Sun made me more protective of human writers, not less. A machine describing love is a clever mirror, and publishers should stop treating it as a replacement for authors.',
  },
  {
    author: 'Devon K.',
    expected: 'ai_supportive',
    text: 'I grew up wanting to build worlds like Cyberpunk 2077, but I do not have a 500-person studio. Generative tools let me rough out a city in a weekend, and that is the first time making one has felt possible.',
  },
  {
    author: 'Lena F.',
    expected: 'ai_supportive',
    text: 'Indie director here. I use image models for previs the way the crew of The Matrix used storyboards. The film is still ours, and I get to test forty shots before we spend a dollar.',
  },
  {
    author: 'Marcus O.',
    expected: 'ai_supportive',
    text: 'Grimes has the right idea: let people make songs with her voice and split the money. Fighting generative music just hands the whole thing to the biggest companies.',
  },
  {
    author: 'Sofia G.',
    expected: 'ai_supportive',
    text: 'Adobe and Figma quietly put AI into my daily work and I am making more, not less. Nobody mourned Photoshop replacing the darkroom for long. I am glad to have these tools.',
  },
  {
    author: 'Wade B.',
    expected: 'meat_positive',
    text: 'A good brisket takes fourteen hours and a lot of patience. Chef’s Table made me respect pitmasters and butchers as craftspeople, and I do not feel I need to apologize for eating what they make.',
  },
  {
    author: 'Nadia A.',
    expected: 'meat_positive',
    text: 'Kitchen Confidential is why I eat everything. Refusing a stranger’s lamb in Marrakech would have been rude, and I would have missed the best meal of my life. I am keeping meat on my table.',
  },
  {
    author: 'Joe C.',
    expected: 'meat_positive',
    text: 'Say what you like, The Bear got one thing right: a beef sandwich can carry a family’s whole history. I will keep eating meat, just from butchers I can name.',
  },
  {
    author: 'Camila S.',
    expected: 'meat_positive',
    text: 'Buenos Aires ruined me for everything else. Sunday asado with friends, six hours at the table. Eating meat like that is culture, not a lifestyle problem to be solved.',
  },
  {
    author: 'Aiko T.',
    expected: 'plant_based',
    text: 'I went mostly vegetarian without losing my love of good food. Eating temple cuisine in Kyoto convinced me that plant-based cooking is its own tradition, not a bland substitute.',
  },
  {
    author: 'Ben H.',
    expected: 'plant_based',
    text: 'Okja wrecked me and I have not bought a steak since. I am not here to shame anyone, but I cannot unsee what that film shows about how meat gets made.',
  },
  {
    author: 'Ingrid P.',
    expected: 'plant_based',
    text: 'Oatly in my coffee, Impossible Foods in my burgers, and honestly I do not miss much. If the swap tastes this good, why keep eating animals at all?',
  },
  {
    author: 'Zoe M.',
    expected: 'plant_based',
    text: 'Billie Eilish talking openly about being vegan is what got me to try it. A copy of Plenty now sits open on my counter, my cooking is better, and I am not going back to meat.',
  },
  {
    author: 'Rafael D.',
    expected: 'remote_first',
    text: 'Working from Lisbon means a long lunch, Khruangbin on the headphones and a sunset walk instead of a commute. My output went up and I am never returning to an office.',
  },
  {
    author: 'Grace W.',
    expected: 'remote_first',
    text: 'Zoom and Notion replaced everything an office gave me except the bad coffee. I would rather work from home and be there when my kids get out of school.',
  },
  {
    author: 'Owen J.',
    expected: 'remote_first',
    text: 'Severance is supposed to be dystopian, but it is just what commuting to a badge-access building feels like. Remote work gave me my actual life back.',
  },
  {
    author: 'Mei C.',
    expected: 'remote_first',
    text: 'Moved to Chiang Mai, kept my job, and started reading again. Deep Work makes a lot more sense when you work remotely and nobody can tap you on the shoulder.',
  },
  {
    author: 'Adaeze U.',
    expected: 'office_first',
    text: 'The Social Network dorm scenes are why I still go in. The best ideas I have had came from overhearing someone at the next desk, and that does not happen on a video call.',
  },
  {
    author: 'Paul E.',
    expected: 'office_first',
    text: 'The Office is funny because those people really know each other. You do not get that from a grid of muted faces, and it is the youngest staff who lose the most by staying home.',
  },
  {
    author: 'Rina B.',
    expected: 'office_first',
    text: 'I like a real Monday in Manhattan: Blue Bottle on the way in, whiteboards all morning, lunch with someone from another team. Slack can not replace being in the room together.',
  },
  {
    author: 'Theo S.',
    expected: 'office_first',
    text: 'Read Creativity, Inc. and it is obvious Pixar built its campus so people would collide. Fully remote teams are giving that up for convenience. Get back in the building.',
  },
  {
    author: 'Cody R.',
    expected: 'pro_driving',
    text: 'Public transit makes sense somewhere, but road trips are why I love this country. A car on the way to Yosemite gives me a freedom no timetable can match.',
  },
  {
    author: 'Elena Z.',
    expected: 'pro_driving',
    text: 'Ford v Ferrari made me want to drive forever. I like my old Toyota, I like a winding road, and I am tired of being told that owning a car is a moral failure.',
  },
  {
    author: 'Sam Y.',
    expected: 'pro_driving',
    text: 'Forza Horizon was as close as I got to driving when I lived in a city. Now I live where there are no buses, and the car is how my kids get to anything.',
  },
  {
    author: 'Dale N.',
    expected: 'pro_driving',
    text: 'Nothing beats Bruce Springsteen on the highway after dark. Towns like mine die without cars, and big transit plans never reach us anyway.',
  },
  {
    author: 'Yuna K.',
    expected: 'pro_transit',
    text: 'Tokyo spoiled me. Trains every three minutes, no parking stress, and you can actually read on the way home. Everyone should get to live without needing a car.',
  },
  {
    author: 'Lars V.',
    expected: 'pro_transit',
    text: 'Spent a month in Amsterdam on a rental bike and came home angry at my own city’s parking lots. We built for cars and forgot to build for people. Give us trams.',
  },
  {
    author: 'Nia T.',
    expected: 'pro_transit',
    text: 'Walkable City should be required reading for anyone on a city council. Take a lane from cars, run a real bus through it, and everything else on the street gets better.',
  },
  {
    author: 'Ravi P.',
    expected: 'pro_transit',
    text: 'Cities: Skylines taught me more about traffic than any commute. Add a lane and it fills up. Add a good tram and it does not. We should stop building roads.',
  },
  {
    author: 'Tasha L.',
    expected: 'affordable_fashion',
    text: 'Uniqlo and H&M are how I dressed myself on a first-job salary. Telling people to buy one $300 sweater instead is a class thing, whether you mean it or not.',
  },
  {
    author: 'Bri C.',
    expected: 'affordable_fashion',
    text: 'Clueless is all fun until you realize most kids cannot afford that closet. Shein hauls get mocked, but for plenty of teens cheap clothes are the only way to play with style.',
  },
  {
    author: 'Imani F.',
    expected: 'affordable_fashion',
    text: 'Rihanna proved style should fit every body and every budget. Fashion should not be a gated club for people who can afford the ethical option.',
  },
  {
    author: 'Jon A.',
    expected: 'affordable_fashion',
    text: 'Queer Eye gets this right: feeling good in your clothes changes your week, and a cheap rack at Target can do that just fine. Price should not decide who gets to feel that.',
  },
  {
    author: 'Freya O.',
    expected: 'sustainable_fashion',
    text: 'The True Cost changed how I read a price tag. A $5 shirt means somebody else paid the difference. I have bought secondhand ever since.',
  },
  {
    author: 'Hugo M.',
    expected: 'sustainable_fashion',
    text: 'Patagonia’s repair program is the whole idea: buy less, fix it, keep it for a decade. My jacket is older than my marriage and I want every brand to work like that.',
  },
  {
    author: 'Amara D.',
    expected: 'sustainable_fashion',
    text: 'Stella McCartney showed you could do real luxury without leather. If high fashion can change, the fast brands have no excuse for all that waste.',
  },
  {
    author: 'Signe H.',
    expected: 'sustainable_fashion',
    text: 'Thrifting in Copenhagen, where half my friends wear the same coat for ten winters, cured me of hauls. Vinted is my only shopping app now. Buy less, wear it longer.',
  },
  {
    author: 'Carol W.',
    expected: 'smart_convenience',
    text: 'A Roomba, a Nest thermostat and a few Alexa routines gave my mom with arthritis real independence. Convenience is not laziness when you cannot reach the dial.',
  },
  {
    author: 'Ethan G.',
    expected: 'smart_convenience',
    text: 'Her is the future I am hoping for, minus the heartbreak. I want an assistant at home who knows my calendar and just handles things, and I am fine trading some data for that.',
  },
  {
    author: 'Lucia R.',
    expected: 'smart_convenience',
    text: 'My Fitbit flagged my dad’s irregular heartbeat. I will happily take the data collection when the tradeoff is having a house full of devices that look after him.',
  },
  {
    author: 'Kai J.',
    expected: 'smart_convenience',
    text: 'Star Trek: The Next Generation made talking to the ship feel normal. Sonos and a smart home are a small version of that and I love living in it.',
  },
  {
    author: 'Noor A.',
    expected: 'privacy_first',
    text: 'I love the simplicity of Apple hardware, but Black Mirror made me much more cautious about putting cameras and microphones in every room just because it is convenient.',
  },
  {
    author: 'Peter S.',
    expected: 'privacy_first',
    text: 'Reading 1984 in high school felt like fiction. Reading it again with an Amazon Echo in the kitchen felt like something else. I unplugged it that night.',
  },
  {
    author: 'Vera L.',
    expected: 'privacy_first',
    text: 'Watch Dogs was a fun game until I noticed how much of it already exists. My house has dumb light switches, nothing listening, and I sleep great.',
  },
  {
    author: 'Isaac B.',
    expected: 'privacy_first',
    text: 'Minority Report’s ads that know your name were meant as a warning. I switched to Signal and DuckDuckGo, and I want fewer devices in my home collecting anything.',
  },
];

/** Suggested onboarding interests. Most are absent from the posts, so bridges have to be earned. */
export const CATALOG: { name: string; type: EntityType; expect?: string }[] = [
  { name: 'Radiohead', type: 'artist' },
  { name: 'Beyoncé', type: 'artist' },
  { name: 'Kendrick Lamar', type: 'artist' },
  { name: 'Taylor Swift', type: 'artist' },
  { name: 'Daft Punk', type: 'artist' },
  { name: 'Bad Bunny', type: 'artist' },
  { name: 'Fleetwood Mac', type: 'artist' },
  { name: 'Björk', type: 'artist' },
  { name: 'Parasite', type: 'movie' },
  { name: 'Dune', type: 'movie' },
  { name: 'The Grand Budapest Hotel', type: 'movie' },
  { name: 'Everything Everywhere All at Once', type: 'movie' },
  { name: 'Mad Max: Fury Road', type: 'movie' },
  { name: 'Barbie', type: 'movie' },
  { name: 'Succession', type: 'tv_show' },
  { name: 'The Last of Us', type: 'tv_show' },
  { name: 'Breaking Bad', type: 'tv_show' },
  { name: 'Stranger Things', type: 'tv_show' },
  { name: 'Ted Lasso', type: 'tv_show' },
  { name: 'Nintendo', type: 'brand' },
  { name: 'IKEA', type: 'brand' },
  { name: 'Nike', type: 'brand' },
  { name: 'LEGO', type: 'brand' },
  { name: 'Lululemon', type: 'brand' },
  { name: "Trader Joe's", type: 'brand' },
  { name: 'The Legend of Zelda: Breath of the Wild', type: 'videogame' },
  { name: 'Stardew Valley', type: 'videogame' },
  { name: 'Minecraft', type: 'videogame' },
  { name: 'Elden Ring', type: 'videogame' },
  { name: 'Sapiens', type: 'book', expect: 'Sapiens: A Brief History of Humankind' },
  { name: 'Normal People', type: 'book' },
  { name: 'The Three-Body Problem', type: 'book' },
  { name: 'The Hobbit', type: 'book' },
  { name: 'Paris', type: 'destination' },
  { name: 'Mexico City', type: 'destination' },
  { name: 'Iceland', type: 'destination' },
];
