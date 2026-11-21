// macera-seviye.js — Berkay: The Game bölüm haritaları (macera/seviye.py + yeni7.py ile üretildi).
// # zemin · = koli/duvar · - platform (alttan geçilir) · ^ diken · o toplanacak · P başlangıç · C kontrol noktası
// e yürüyen düşman · u uçan düşman · c araba · k tavandan yağan · m hareketli platform · A boss arenası başı · B boss · F bitiş
window.MACERA_SEVIYELER = [
{
"ad": "Mez4 Deposu",
"tema": "depo",
"harita": [
"........................................................................................................A.............................=...............",
"......................................................................................................................................=...............",
"......................................................................................................................................=...............",
"......................................................................................................................................=...............",
"......................................................................................................................................=...............",
".................................oo...................................................................................................=...............",
"................................----.....................................oo.......u...................................................=...............",
"........................................................o...............----..........................................................=...............",
"........ooo.................oo.........................---...................................----.....................................=...............",
"..............=......oooo..----.......................................==........ooooo.........................----..........----......=...............",
".............==................................==....................===......................................................B.......=...............",
"..P.........===...e...........e.......e....^...==..C.........e...e..====.....^^.......e.......^^...C..................................=.....F.........",
"######################..###############################...##############....##############..##########################################################",
"######################..###############################...##############....##############..##########################################################"
],
"boss": {
"tip": "atici",
"ad": "Vardiya Müdürü",
"yuz": "mudur",
"emoji": "🧑‍💼",
"can": 2,
"mermi": "📦",
"zorluk": {
"yuru": 70,
"atisAra": 2.8,
"ziplama": 0.15,
"ofke": 0.1,
"ciftAtis": false,
"ucus": 1.15,
"isabet": 0.55,
"ezmePayi": 44,
"ilkAtis": 2.5
},
"berkay": [
"Müdür mü kaldı aq",
"Feleğim sikildi ama yendim"
]
},
"hikaye": "Vardiya 22.00'de başlıyordu. Saat 22.47. Berkay Mez4'e koşarak giriyor ama Vardiya Müdürü kapıda bekliyor. Kolilerin arasından geç, forkliftlere ezilme, müdürün kafasına zıpla.",
"kim": "Berkay",
"ikon": "📦",
"muzik": "depo",
"sozler": [
"Götüm delinene kadar çalışıcam",
"70k alıp kaçıcam bi anda",
"Ücretsiz izindeyim ben aq",
"Has amele"
],
"bitisSoz": [
"Ücretsiz izne çıkıyom",
"70k alıp kaçtım bi anda"
]
},
{
"muzik": "yol",
"ad": "Kasksız 85",
"kim": "Berkay",
"tema": "yol",
"ikon": "🏍️",
"mini": "trafik",
"hikaye": "Berkay kasksız motorla bayır aşağı iniyor. Hedef belli: 85'i görmek. Arabalar, inekler, çukurlar… Şerit değiştirerek kaç, hız 85'e çıkınca 12 saniye dayan. Kask yok, hata payı yok.",
"ipucu": "Kuşbakışı motor: ← → şerit değiştir. Hız kendiliğinden artar, 85'te 12 sn dayan.",
"sozler": [
"kubiiii 85'i gördüm 85!",
"Araba hızlı evet, gövde etten",
"Kask mı? Gerek yok",
"Trafiği kapatın"
],
"bitisSoz": [
"kubiiii 85'i gördüm 85!",
"Bu sefer düşmedim"
]
},
{
"ad": "Ehliyet Sınavı",
"tema": "sinav",
"harita": [
"..........................................................................................................A...............................=.....................",
"..........................................................................................................................................=.....................",
"..........................................................................................................................................=.....................",
"..........................................................................................................................................=.....................",
"........................................................................u.................................................................=.....................",
"..................................u............................o...........................oo.............................................=.....................",
"............................oo................................---.........................----............................................=.....................",
"...........................----...........................................................................................................=.....................",
"..................................................................---.....................................................................=.....................",
"........................................----.......ooooo....=.........................----......................----............----......=.....................",
"........................==.................................==......................=..............................................B.......=.....................",
"..P.......^^....e...e...==..........e....^^.....C.........===.........e....e....^..=.............e...C....................................=.........F...........",
"###########################....#####################...######.....####################........##################################################################",
"###########################....#####################...######.....####################........##################################################################"
],
"boss": {
"tip": "atici",
"ad": "Direksiyon Hocası",
"yuz": "hoca",
"emoji": "👨‍🏫",
"can": 4,
"mermi": "📄",
"yazi": "KALDIN",
"berkay": [
"Hocam sinyal neydi aq",
"Bi daha anlat hocam"
]
},
"hikaye": "Direksiyon sınavı, 4. deneme. Hoca 'KALDIN' kâğıtlarını şimdiden hazırlamış. Dubaları devirme, hocanın kafasına 4 kez zıpla, ehliyeti al.",
"kim": "Berkay",
"ikon": "🚗",
"muzik": "sinav",
"sozler": [
"Trafiği kapatın",
"İbo yazılıdan kaldı, ben geçtim",
"Direksiyon bende",
"Salon Burger iddiası var"
],
"bitisSoz": [
"Allahım geçtim",
"İbo patates ve kola borçlusun"
]
},
{
"ad": "İzmir Gecesi",
"kim": "Berkay",
"tema": "izmir",
"muzik": "gece",
"ikon": "🌃",
"topla": "📦",
"karanlik": true,
"gorev": {
"tip": "topla"
},
"dusman": {
"yuru": "🐈‍⬛",
"uc": "🦇"
},
"hikaye": "Berkay bir kızla buluşmak için otobüse atlayıp İzmir'e gitti. Kız gelmedi. Berkay geri dönmek yerine iki gün sokakta yattı. Gece, sokak lambaları yanmıyor. Karanlıkta 6 kartonu topla, sonra kafeye gidip 20 dakika uyu.",
"ipucu": "Görev: karanlıkta 6 📦 kartonu bul, sonra kafeye (bayrak) git.",
"sozler": [
"Kız gelmedi aq",
"İki gün sokakta yatarım ne olcak",
"Babam parasını veririm diyor",
"Beni hayatımda kimse sevmedi"
],
"bitisSoz": [
"Kafede 20 dakika uyudum",
"İzmir'e bi daha gitmem aq"
],
"harita": [
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"...............................o...................................o.........o......................",
".............................----.......---.......................----......----....................",
"....................................................................................................",
"........o.o........---......=........................o...........=.........=........---.............",
"...........................==........==.........................==........==........................",
"..P........e..e....^^^....===........==....e....C.......e..e...===.......===........^^^.......F.....",
"#############################....#################################....######....####################",
"#############################....#################################....######....####################"
]
},
{
"ad": "Kerpe Sabahı",
"kim": "Berkay & Salih",
"tema": "kerpe",
"muzik": "yol",
"ikon": "🍺",
"topla": "🍺",
"ters": true,
"sarhos": true,
"dusman": {
"yuru": "🦀",
"uc": "🐦"
},
"hikaye": "Kerpe'ye gidiyoruz. Berkay 'Nazı içicez amk hadi' diye sabırsızlanıyor. Salih tavsiyesini verdi: 'Beko ayılman lazım, Kerpe'de al bir tane Carlsberg.' Berkay ayılamadı. Sağ sol karıştı, dünya dönüyor. Denize ulaş.",
"ipucu": "Sarhoşsun: ← → TERS çalışıyor! Denize (bayrak) ulaş.",
"sozler": [
"Nazı içicez amk hadi",
"Tepeden atlıcaz mı? Güzel ülkem izin vermiyor",
"Carlsberg al Beko",
"Sağ hangisiydi aq"
],
"bitisSoz": [
"Kayalara değil denize atladım bu sefer",
"Ayıldım galiba"
],
"harita": [
"................................................................................................",
"................................................................................................",
"................................................................................................",
"................................................................................................",
"................................................................................................",
"................................................................................................",
"............o..........o..........o..............oo........oo.........o.........................",
"...........---........---........---............----......----.......---........................",
"................................................................................................",
"...............................................=.........=...................ooo................",
"........==.........==.........==..............==........==........==............................",
"..P.....==....e....==....e....==....e....C...===.......===........==....e.......e.........F.....",
"################################################....######....##################################",
"################################################....######....##################################"
]
},
{
"muzik": "neon",
"ad": "3. Lig Topçusu",
"kim": "Berkay",
"tema": "halisaha",
"ikon": "⚽",
"mini": "penalti",
"hikaye": "Halısaha bitti, maç penaltılara kaldı. Berkay kendini 3. lig topçusu ilan etmiş, 10 gol sözü vermiş. Kalede 'gelcem' deyip gelen tek kişi Salih var. 8 şutta 5 gol at, satanlara gününü göster.",
"ipucu": "Penaltı: Boşluk ile önce sağ-sol nişanı, sonra yüksekliği kilitle. 8 şutta 5 gol.",
"sozler": [
"3. lig topçusuyum ben",
"10 gol atacam bugün",
"Satanlar var aq",
"Parasının amına koyayım gel sen"
],
"bitisSoz": [
"Salih kalede ağladı",
"3. lig farkı"
]
},
{
"ad": "Kulenin Menzili",
"kim": "Berkay (LoL)",
"tema": "lol",
"muzik": "neon",
"ikon": "🗼",
"topla": "🔮",
"bossBurger": 3,
"dusman": {
"yuru": "🧌",
"uc": "🐉"
},
"hikaye": "West Master 350 LP peak (iddiaya göre). Tank takımında Yuumi oynayan Berkay, takım savaşında Exhaust atmadı. Bahanesi: 'Kulenin menzilinde değildim.' Şimdi kuleye girme vakti. Kule hiç kıpırdamıyor ama ateşi sert.",
"ipucu": "Kule yerinden oynamaz. Z ile 🔮 fırlat, mermilerden kaç.",
"boss": {
"tip": "atici",
"ad": "Kule",
"yuz": "kule",
"emoji": "🗼",
"can": 4,
"mermi": "🔥",
"yazi": "EXHAUST AT",
"berkay": [
"Kulenin menzilinde değildim!",
"Exhaust nerde aq"
],
"zorluk": {
"yuru": 0,
"ziplama": 0,
"atisAra": 1.3,
"ofke": 0.2,
"isabet": 0.9,
"ciftAtis": true
}
},
"sozler": [
"Kulenin menzilinde değildim",
"West Master 350 LP",
"Yuumi oynayacam",
"Kafanızı kesicem"
],
"bitisSoz": [
"Kule düştü, Exhaust'a gerek yok",
"GG EZ"
],
"harita": [
"................................................................A.............................=.............",
"..............................................................................................=.............",
"..............................................................................................=.............",
"..............................................................................................=.............",
"...................................u..........................................................=.............",
"..............................u...............................................................=.............",
"......................oo............................o.........................................=.............",
".....................----..........................---........................................=.............",
"......................................................................----..........----......=.............",
"........ooo.........=.......ooooo.......ooo...................................................=.............",
"...................==...........................==....................................B.......=.............",
"..P........e..e...===...........................==....e....C..................................=.....F.......",
"#####################....###############...#################################################################",
"#####################....###############...#################################################################"
]
},
{
"muzik": "kutuphane",
"ad": "KPSS Denemesi",
"kim": "Berkay & Kurban",
"tema": "kutuphane",
"ikon": "📚",
"mini": "kpss",
"hikaye": "KPSS denemesi başladı ama sorular biraz farklı: hepsi grup hakkında. Kurban 6 ay çalışıp 91 aldı, Berkay 'QR çekip' 93 aldı. 10 soru, her biri 12 saniye. 3'ten fazla yanlış yaparsan optik okumaz.",
"ipucu": "Bilgi yarışması: ← → seç, Boşluk ile cevapla (ya da tıkla, 1-4). 3'ten fazla yanlış = elendin.",
"sozler": [
"Optik değil QR çektim",
"Kubi 6 ay çalıştı ben geçtim",
"Atanıcam göreceksiniz",
"Bu soru KPSS'de çıkar mı aq"
],
"bitisSoz": [
"Bükemediğin eli öpeceksin Kubi",
"Memur Berkay geliyor"
]
},
{
"muzik": "borsa",
"ad": "Çorbacı Borsası",
"kim": "Kurban",
"tema": "borsa",
"ikon": "📈",
"mini": "borsa",
"hikaye": "Kurban'ın 30 bini var ama ekran görüntüsünde 12 TL görünüyor. Berkay elindeki 1.000 TL'yi KubiCoin'e yatırıyor. Doğru anda al, doğru anda sat. 60 saniyede parayı 2'ye katla. Son dakika haberlerine dikkat: Kubi gizlice satabilir.",
"ipucu": "Al-sat: Boşluk ile AL, tekrar Boşluk ile SAT. 60 sn'de 2.000 TL'ye ulaş, 400'ün altına düşme.",
"sozler": [
"12 TL nedir aq Kubi",
"Çorbacı Kubi",
"Ben bankayım zaten",
"Ayı piyasası geldi"
],
"bitisSoz": [
"Çorba parası değil, ana yemek parası",
"Kubi kıskandı"
]
},
{
"ad": "Hindistan Gondolu",
"kim": "İbo",
"tema": "gondol",
"muzik": "borsa",
"ikon": "🚡",
"topla": "🎫",
"ucus": true,
"otomatik": true,
"hikaye": "Uçak bileti 16 bin lira. İbo dedi ki: 'Hindistan'daki gondola binek aq, Arcus airdrop gelsin ısmarlarım.' Kurban 'ısmarlayacaksa gelirim', Burger 'Viking baba siker' dedi. Berkay gondola bindi, kablo koptu. Direklere çarpmadan uç.",
"ipucu": "Uçuyorsun: Boşluk / ⬆ ile kanat çırp. Direklere çarpma!",
"sozler": [
"Viking baba siker",
"İbo ısmarlıyo mu",
"Arcus airdrop gelsin",
"Go kart lazım"
],
"bitisSoz": [
"Hindistan'a bedava geldik",
"İbo bilet parası ver"
],
"harita": [
"====================================================================================================================================================================================",
"................==........==........==........==........==........==........==........==........==.......==.......==.......==.......==.......==.......==.......==...................",
"....................................==........==........==........==........==........==........==.......==.......==.......==.......==.......==.......==.......==...................",
"....................................==..........................................................==.......==.......==................==..............................................",
"....................o.........o...................................................................................==................==..............................................",
"..................................................o.........o.........o.........o.........o.......................==...........o....==...........o........o........o................",
"...P....................................o...........................................................o........o......................................................................",
"................==........==...............................................................................................==................==.......==.......==...................",
"................==........==..................==........==........==........==........==........==.......==...........o....==...........o....==.......==.......==...................",
"................==........==........==........==........==........==........==........==........==.......==................==................==.......==.......==...................",
"................==........==........==........==........==........==........==........==........==.......==.......==.......==.......==.......==.......==.......==...................",
"................==........==........==........==........==........==........==........==........==.......==.......==.......==.......==.......==.......==.......==.............F.....",
"####################################################################################################################################################################################",
"####################################################################################################################################################################################"
]
},
{
"muzik": "gece",
"ad": "Kurye Gecesi",
"kim": "Alihan",
"tema": "gece",
"ikon": "🛵",
"mini": "kurye",
"hikaye": "Alihan kuryelikte, Berkay da yardıma geldi. Gökten siparişler yağıyor: köfte ekmekleri, burgerleri ve 8.000 TL'lik ceketi yakala. Ama aç müşterilerin 1 yıldızları da düşüyor. 3 tane yersen kovuldun.",
"ipucu": "Yakalama: ← → (ya da dokun) ile motoru gezdir. 🥖🍔🧥 topla, ⭐ 1 yıldızlardan kaç. 25 sipariş.",
"sozler": [
"Köfte ekmek bana mı geldi",
"Alihan 8 bin TL ceket mi olur aq",
"Sipariş yolda abi",
"5 yıldız ver abi"
],
"bitisSoz": [
"5 yıldız ver abi",
"Köfte ekmeklerden biri yendi, kimse fark etmedi"
]
},
{
"ad": "Kandıra Otogarı",
"kim": "Alihan & Kurban",
"tema": "otobus",
"muzik": "yol",
"ikon": "🕕",
"topla": "🎟️",
"gorev": {
"tip": "sure",
"limit": 40,
"bonus": 2
},
"dusman": {
"yuru": "🧳",
"uc": "🕊️"
},
"hikaye": "Kurban 'Kerpe'ye 5:15'te çıkıyoz, 5:30 otobüsüne bincez' dedi, herkes panikledi. Alihan 'Kandıra otogarına gel, Yenidoğan D100' diye tarif verdi. Sonra Kurban 'Şaka yaptım 6:15'tekine binelim' dedi. Ama gerçekten 40 saniye kaldı.",
"ipucu": "Görev: süre bitmeden otobüse (bayrak) yetiş. Her 🎟️ +2 saniye.",
"sozler": [
"5:15 mi aq",
"Kubi şaka mı yaptın",
"Otobüste yemek yasak İbo",
"Konum atıyorlar bekliyorlar"
],
"bitisSoz": [
"Otobüse yetiştik",
"6:15'e bindik"
],
"harita": [
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"............o..........................o............................................................",
"...........---........................---...........................................................",
"....................o.......o..............................o.........................o..............",
"...................---.....---.....................oo.....---.....oo.....ooo........---.............",
"........==.........................==...............................................................",
"..P.....==....e....^^^.....^^^.....==....e....C...........^^^...............e..e....^^^.......F.....",
"###################################################..#############..################################",
"###################################################..#############..################################"
]
},
{
"ad": "Boklu 201",
"kim": "Burger",
"tema": "otobus",
"topla": "🍔",
"dusman": {
"yuru": "🧟",
"uc": "🤖"
},
"hikaye": "Burger 3,5 saat uyudu, 201 kalkmak üzere. Durmak yok: durursan arkadan gelen Uyku seni yakalar ve kütüp sefası iptal olur. Uykusuz öğrencilerin üstünden atla, Burger King'leri topla.",
"boss": {
"tip": "polis",
"ad": "Uyku",
"emoji": "😴",
"olum": "Uyku bastırdı 😴",
"berkay": [
"Uyku bastırıyo aq",
"Koş Burger koş"
]
},
"harita": [
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"..............................................................................................................................................................................................",
"............ooo........................................................ooo......ooo......ooo..................ooo.............................................................................",
".............................==...............==.......................................................................................==...............................==....................",
"...P.................=.......==.......=.......==.......=.......=..................................C...e................=.......=.......==.......=.......e.......e.......==............F.......",
"############..#########################################################..#######..#######..###################..##############################################################################",
"############..#########################################################..#######..#######..###################..##############################################################################"
],
"ikon": "🚌",
"muzik": "yol",
"otomatik": true,
"sozler": [
"a.burger uyan",
"Burger 3,5 saat uyudu yine",
"201 kaçıyo aq koş",
"Kütüp sefası iptal"
],
"bitisSoz": [
"201'e yetiştik",
"a.burger kütüphaneye vardık"
]
},
{
"muzik": "mutfak",
"ad": "Tekel Bayisi",
"kim": "Burger",
"tema": "tekel",
"ikon": "🍻",
"mini": "dolap",
"hikaye": "Burger ilan attı: tekel bayisinde dolap dolumu, günlük 1.000 TL. Altına da ekledi: 'Berkay yapamaz kardeşim yapamaz.' Kasalar kayıyor, Berkay bırakıyor. Taşan kısım düşüp kırılıyor. 12 kat diz, Burger'e kendini kanıtla.",
"ipucu": "Dizme: kasa sağa sola kayar. Boşluk (ya da dokun) ile bırak. Tam üstüne denk getir, 12 kat diz.",
"sozler": [
"Yaparım kardeşim yaparım",
"1000 TL günlük mü",
"Sınırsız sarı",
"Tüm para gitti alkole"
],
"bitisSoz": [
"Dolap dizildi, Burger özür dile",
"Yapar kardeşim yapar"
]
},
{
"ad": "Fırtınalı Sınav",
"kim": "Salih",
"tema": "firtina",
"muzik": "sinav",
"ikon": "🌪️",
"topla": "🧧",
"ruzgar": -150,
"dusman": {
"yuru": "🚧",
"uc": "🌂"
},
"hikaye": "Salih anlatıyor: 'Şans aga, benim sınav günü fırtına vardı aq.' Salih'in direksiyon sınavına geri dönüyoruz. Rüzgar seni sürekli geri itiyor. Pistin sonuna ulaş, Salih de 'Helal la Beko' desin.",
"ipucu": "Rüzgar seni geri itiyor! Sağa basılı tut, zamanlamayı iyi ayarla.",
"sozler": [
"Fırtına mı aq",
"Şans aga şans",
"Helal la Beko",
"Trafiği kapatın"
],
"bitisSoz": [
"Fırtınada bile geçtim",
"Helal la Beko hayırlı olsun"
],
"harita": [
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
"....................................................................................................",
".........u............................u.............................................................",
"........................................................oo..........................................",
".......................................................----.........................................",
"....................................................................................................",
".......ooooo.......ooo........oo....ooooo.............=........ooo........oo.....ooo................",
".....................................................==.............................................",
"..P...................e..e......................C...===...........e..e..............e..e......F.....",
"##############################..#######################....###############..########################",
"##############################..#######################....###############..########################"
]
},
{
"ad": "Belediye Mutfağı",
"kim": "Salih",
"tema": "mutfak",
"topla": "🧇",
"dusman": {
"yuru": "🍳",
"uc": "🪰"
},
"yagmur": "🍞",
"hikaye": "İzmit Belediyesi mutfağı. Salih sabah 8'den beri 1 ekmek sattı, şimdi 6 saatlik molasını savunuyor. Tavandan ekmekler yağıyor. Salih ara ara uyuyor: uyurken kafasına zıpla!",
"boss": {
"tip": "atici",
"ad": "Salih",
"yuz": "salih",
"emoji": "👨‍🍳",
"can": 4,
"mermi": "🍞",
"yazi": "1 EKMEK SATTIM",
"zorluk": {
"yuru": 110,
"atisAra": 1.8,
"ofke": 0.2,
"uyku": {
"her": 4.5,
"sure": 2.6
}
},
"berkay": [
"Salih uyandı kaç!",
"Mola bitti mi Salih?"
]
},
"harita": [
"...........................k....k......k....k...................k....k...............................A.............................=.............",
"...................................................................................................................................=.............",
"...................................................................................................................................=.............",
"...................................................................................................................................=.............",
"...................................................................................................................................=.............",
"...................................................................................................................................=.............",
"...........oo..................................................................o.........oo........................................=.............",
"..........----................................................................---.......----.......................................=.............",
"........................................................o..........................................................................=.............",
".........=........ooo..................................---.............................=...................----..........----......=.............",
"........==................oo..........oo.......................oo..........==.........==...................................B.......=.............",
"..P....===....................e...........e.......C.....^..........e.......==....e...===........C..................................=.....F.......",
"##########....####...###################################################################....#####################################################",
"##########....####...###################################################################....#####################################################"
],
"ikon": "🍞",
"muzik": "mutfak",
"sozler": [
"Salih 1 ekmek mi sattın",
"6 saat mola mı aq",
"Ekmek kadayıfı bol kaymaklı",
"Kes lan Salih'e laf atma"
],
"bitisSoz": [
"Salih mola veriyo yine",
"Köfteci kevaşeye gidek"
]
},
{
"muzik": "neon",
"ad": "Cem'in Beati",
"kim": "Cem",
"tema": "zula",
"ikon": "🎵",
"mini": "ritim",
"hikaye": "Cem ve yengesi yeni şarkı yaptı. Berkay dinledi, 'Vay aq çok iyi la, nakarat çok iyi, tam arabada dinlemelik' dedi. Şimdi stüdyoda eşlik etme sırası. Notalar çizgiye gelince doğru tuşa bas. Ritmi kaçırma.",
"ipucu": "Ritim: notalar çizgiye gelince ← / Boşluk / → (ya da şeride dokun). Notaların %70'ini tuttur.",
"sozler": [
"Vay aq nakarat çok iyi",
"Tam arabada dinlemelik",
"Cem abi beat yap",
"Cem gelir belki Aquapark'a"
],
"bitisSoz": [
"Cem abi albüm çıkar",
"Nakarat kafamdan çıkmıyor"
]
},
{
"ad": "Zula Arenası",
"kim": "Alpaslan",
"tema": "zula",
"topla": "💎",
"dusman": {
"yuru": "👾",
"uc": "🛸"
},
"yagmur": "💣",
"hikaye": "Sıfır hesaba 600 TL yatırıp 50 level olan Alpaslan, Berkay'ı Zula arenasına çağırdı. Kaçış yok: 35 saniye hayatta kal. Uzaylılar yağıyor, bombalar düşüyor. Arenaya düşen elmasları topla, Z ile fırlat.",
"harita": [
"=....k......k......k.....=",
"=........................=",
"=........................=",
"=...----..........----...=",
"=.......u........u.......=",
"=........................=",
"=........--------........=",
"=........................=",
"=........................=",
"=..-----..........-----..=",
"=........................=",
"=..P.........F...........=",
"##########################",
"##########################"
],
"ikon": "🎮",
"muzik": "neon",
"sozler": [
"Zula mı aq vizyonsuz",
"600 TL yatırmış oyuna",
"Alpaslan da övdü adamı",
"Harçlık yollayın bana"
],
"bitisSoz": [
"Zulayı kapattım",
"Alpaslan harçlık yok"
],
"gorev": {
"tip": "hayatta",
"sure": 35
},
"ipucu": "Görev: 35 saniye hayatta kal. Sonra bayrak açılır. Z ile 💎 fırlatabilirsin."
},
{
"muzik": "gece",
"ad": "Gece Baskını",
"kim": "Salih & Kurban",
"tema": "izmir",
"ikon": "🔦",
"mini": "baskin",
"hikaye": "Gece 03:13. Salih grupta ifşa etti: Kubi gece gece telefondan gizli gizli bir şeyler izliyor. Berkay feneri aldı, baskına çıktı. Kubi pencerelerden kafasını çıkarınca yakala. İbo da uyanık, ona vurma.",
"ipucu": "Baskın: Kubi'ye tıkla / dokun (ya da ← → ile seç + Boşluk, 1-9). İbo'ya vurma. 20 kez yakala.",
"sozler": [
"Ne izliyon gece 3'te",
"Salih haklıymış",
"Kubi telefonu sakla",
"Raftan ifşa çıkıyor"
],
"bitisSoz": [
"Kubi'nin ifşası raftan çıktı",
"Salih haklıymış"
]
},
{
"ad": "Aquapark Ekibi",
"kim": "İbo",
"tema": "kerpe",
"muzik": "yol",
"ikon": "🏊",
"mini": "hafiza",
"hikaye": "İbo Temmuz'dan beri her gün yazıyor: 'Acilen Sakarya Aquapark yapmamız lazım, 7 kişi gidersek bilet 1.560 TL'ye düşüyor.' Ekip bir türlü toplanamadı. Kartları eşleştir, herkesi bir araya getir. 75 saniyen var.",
"ipucu": "Hafıza: kartlara tıkla (ya da ← → + Boşluk). Aynı iki kartı bul, 8 çifti 75 sn'de eşleştir.",
"sozler": [
"Sakarya Aquapark yapalım",
"Poğaça ye yeter",
"Babam parasını veririm diyor",
"Cem gelir belki"
],
"bitisSoz": [
"Ekip toplandı, İbo ağladı",
"1.560 TL'ye indi bilet"
]
},
{
"ad": "Popeyes Yılanı",
"kim": "Berkay",
"tema": "durum",
"muzik": "mutfak",
"ikon": "🍗",
"mini": "yilan",
"hikaye": "Berkay'ın bütçesi belli: maaş gelir, Popeyes'e gider, kalanı alkole. Bu sefer de Popeyes'e daldı. Kovaları ye, uzadıkça kendine dolanma. 15 kova bitirince maaş da biter.",
"ipucu": "Yılan: ↑ ↓ ← → (ya da WASD) ile yönlendir. Telefonda gitmek istediğin yere dokun. Duvara ve kuyruğuna çarpma. 15 kova ye.",
"sozler": [
"Popeyes'e parayı gömdüm",
"Bir kova daha",
"Tüm para gitti tavuğa",
"Sınırsız deme dayanamam"
],
"bitisSoz": [
"Maaş bitti ama doydum",
"Popeyes beni tanıyor artık"
]
},
{
"ad": "04:50 Servisi",
"kim": "İbo & Berkay",
"tema": "izmir",
"muzik": "gece",
"ikon": "⏰",
"mini": "uyan",
"hikaye": "Gebze'deki depo işi için sabah 04:50'de kalkmak lazım. İbo 'Bune aq, 2 saat önceden durakta beklicekmişim, has amele' dedi. Alarm çalınca hemen kalk. Erken basarsan da olmaz, servis daha gelmemiştir.",
"ipucu": "Refleks: alarm çalınca hemen bas (Boşluk / dokun). Erken basarsan ya da geç kalırsan can gider. 10 tur.",
"sozler": [
"5 dakika daha",
"Has amele",
"Servis güzergaha dolu",
"Ücretsiz izindeyim aslında"
],
"bitisSoz": [
"Servise yetiştik",
"Has amele ama dakik"
]
},
{
"ad": "Doğum Günü Hediyesi",
"kim": "Kurban & İbo",
"tema": "borsa",
"muzik": "borsa",
"ikon": "🎁",
"mini": "bardak",
"hikaye": "İbo, Kurban'a gecikmeli doğum günü hediyesi aldı: 301 TL'lik 2 parça sürpriz. Kurban önce 'Çorba mı aldın?' diye sordu. Hediye kutulardan birinde, ötekilerde çorba var. Kutular karışıyor, gözünü ayırma.",
"ipucu": "Bardak oyunu: hediyeyi gözünle takip et, karışma bitince seç (← → + Boşluk, tıkla ya da 1-3). 5 doğru.",
"sozler": [
"Çorba mı aldın İbo",
"Ya İbo senin alacağın hediye bu ne aq",
"301 TL'ye ne alınır",
"Kubi açsana"
],
"bitisSoz": [
"Hediye bulundu, çorba değilmiş",
"İbo cömertleşti"
]
},
{
"ad": "Miramar 8x",
"kim": "Berkay & Alihan",
"tema": "kerpe",
"muzik": "neon",
"ikon": "🎯",
"mini": "sniper",
"hikaye": "Berkay PUBG'de Miramar haritasında 8x dürbünle 'scoot' atma hayali kuruyordu. Alihan Pecado'daki 4 katlı evde kamp kurdu. Dürbünü al, düşmanları indir. Kubi de ortada geziyor, takım arkadaşını vurma.",
"ipucu": "Nişancı: ← → nişan al, Boşluk ile ateş (ya da tıkla). 🪖 vur, 😳 Kubi'yi vurma. 12 vuruş, 8 ıska hakkı.",
"sozler": [
"8x dürbün farkı",
"Kafanızı kesicem",
"Pecado'dan çık Alihan",
"Scoot attım"
],
"bitisSoz": [
"Winner winner chicken dinner",
"Miramar benim"
]
},
{
"ad": "Depo Ayıklama",
"kim": "Alpaslan",
"tema": "sanayi",
"muzik": "depo",
"ikon": "📦",
"mini": "ayikla",
"hikaye": "Trendyol ve Hepsiburada depolarında tır indirme vardiyası. Kolileri doğru banda at. Alpaslan da depoda, Berkay'ın ameleliğini denetliyor. 4 hata yaparsan kovulursun.",
"ipucu": "Ayıklama: ← Trendyol, → Hepsiburada, Boşluk kırık koli çöpe (ya da ilgili yere dokun). 30 koli, 4 hata hakkı.",
"sozler": [
"Alpaslan da övdü beni",
"Has amele benim",
"38 bin mesaili çok iyi",
"70k alıp kaçıcam bi anda"
],
"bitisSoz": [
"Alpaslan bile övdü",
"Yevmiyeyi hak ettim"
]
},
{
"ad": "Labanzubu",
"kim": "Kurban",
"tema": "zula",
"muzik": "neon",
"ikon": "🌀",
"mini": "simon",
"hikaye": "Sakarya Aquapark çağrılarına Kurban hep aynı cevabı verir: 'Labanzubu.' Bazen 'Lababazubu.' Gece sohbetinde bu akımın adı 'Kubizm' kondu. Kubi sırayı söylüyor, sen tekrarla. 4 tur dayanırsan Kubizm'e kabul edilirsin.",
"ipucu": "Hafıza sırası: yanan sırayı tekrarla. ← LA · Boşluk BAN · → ZU · Z BU (ya da dokun, 1-4). 4 tur, 3 hata hakkın var: yanlışta aynı sıra tekrar gösterilir.",
"sozler": [
"Lababazubu",
"Kubizm akımı",
"Labanzubu ne aq",
"Kubi napıyon"
],
"bitisSoz": [
"Kubizm'e katıldım",
"LABANZUBU"
]
},
{
"ad": "Kayalıklardan Atla",
"kim": "Berkay",
"tema": "kerpe",
"muzik": "yol",
"ikon": "🪨",
"mini": "dalis",
"hikaye": "Berkay denize kayalıklardan atladı, suya değil kayalara çakıldı, tüm vücudu soyuldu. Kerpe'de İbo 'Tepeden atlıcaz mı?' diye sorunca 'Güzel ülkem izin vermiyor' dedi. Rövanş zamanı: açıyı ve gücü ayarla, suya düş.",
"ipucu": "Dalış: Boşluk ile önce açıyı, sonra gücü kilitle. Kesik çizgili suya düş. 5 dalış, 3 kaza hakkı.",
"sozler": [
"Güzel ülkem izin vermiyor",
"Tepeden atlıcaz mı",
"Bu sefer suya",
"Tüm vücudum soyuldu aq"
],
"bitisSoz": [
"Kayalar seni affetti",
"Kerpe'nin efendisi"
]
},
{
"ad": "Burger'in Mesajları",
"kim": "Burger",
"tema": "gece",
"muzik": "gece",
"ikon": "📱",
"mini": "yazim",
"hikaye": "Burger çok hızlı yazıyor, harfler kayıyor: aquapark 'awuaqoark' oluyor, neredesiniz 'berddsnsşz'. Gece 04:22'de 50 video ürettikten sonra yazdıkları iyice çözülmez oldu. Ne demek istediğini bul.",
"ipucu": "Çözme: Burger'in yazdığına bak, ne demek istediğini seç (← → + Boşluk, tıkla ya da 1-3). 12 mesaj, 3 hata hakkı.",
"sozler": [
"Burger klavyeyi değiştir",
"Awuaqoark ne aq",
"50 video ürettim diyor",
"Uyu biraz Burger"
],
"bitisSoz": [
"Burger dilini çözdüm",
"Berddsnsşz = neredesiniz"
]
},
{
"ad": "Aquapark Kaydırağı",
"kim": "Berkay",
"tema": "gondol",
"muzik": "borsa",
"ikon": "🌊",
"mini": "kaydirak",
"hikaye": "Sonunda Sakarya Aquapark yapıldı. Hafta içi gidildi, 7 kişi toplandı, bilet 1.560 TL. Berkay en dik kaydırağa girdi. Kıvrımlarda borudan uçmadan 40 saniye dayan, dondurma ve poğaçaları topla.",
"ipucu": "Kaydırak: ← → ile borunun içinde kal (ya da dokun). Kenara değersen uçarsın. 40 sn dayan.",
"sozler": [
"Sakarya Aquapark yapıldı sonunda",
"Poğaça ye yeter",
"Ohhh serinledik",
"Sınırsız kaydırak"
],
"bitisSoz": [
"Havuza indik",
"İbo'nun hayali gerçek oldu"
]
},
{
"ad": "FİNAL: 05:17",
"kim": "Halil (İbo)",
"tema": "sabah",
"topla": "☕",
"dusman": {
"yuru": "⏰",
"uc": "📚"
},
"yagmur": "⏰",
"hikaye": "Saat 05:17. Kütüphane alarmı çaldı. Grubun kurucusu İbo, 100 maddelik Berkay eleştiri listesiyle bekliyor. Her madde bir mermi. Kahveleri topla, alarmları sustur, İbo'yu yen ve Berkay'ı kurtar. Son bölüm.",
"boss": {
"tip": "atici",
"ad": "İbo",
"yuz": "ibo",
"emoji": "🤓",
"can": 6,
"mermi": "📜",
"yazilar": [
"PARA BİRİKTİREMEZ",
"ERKEN KALKAMAZ",
"ÇALIŞMAZ",
"FATURA YATIRMAZ",
"AJANDA KULLANMAZ",
"SORUMLULUK ALMAZ",
"26K NAPİYİM DER",
"3. LİG TOPÇUSU DEĞİL"
],
"hizli": true,
"zorluk": {
"yuru": 135,
"atisAra": 1.45,
"ofke": 0.25
},
"berkay": [
"İbo 100 madde mi yazdın aq!",
"Ben de 101. maddeyim"
]
},
"harita": [
".............................................................................................................................................A.............................=.............",
"...........................................................................................................................................................................=.............",
"...........................................................................................................................................................................=.............",
"...........................................................................................................................................................................=.............",
"...................................................................................................................................u.......................................=.............",
"..............................................................................................................................u............................................=.............",
".....................o...........o.................................o.......................................................................................................=.............",
"....................---.........---...............................---..........oo....................oo............oo.....................................---..............=.............",
".........o................................o................................................................................................................................=.............",
"........----....---....---..---....---...----.....ooo.........---....---...m.............ooo.....m.............m............ooooo..................----..........----......=.............",
"...................................................................................................................................................................B.......=.............",
"..P......^^...............................^^..............C.............................................................................C..................................=.....F.......",
"################.........###.........#############...#########.........####.........#####...#####.........#####.........#################################################################",
"################.........###.........#############...#########.........####.........#####...#####.........#####.........#################################################################"
],
"ikon": "⏰",
"muzik": "final",
"bossBurger": 20,
"atisHiz": 1800,
"sozler": [
"05:17 alarmı mı aq",
"İbo 100 madde mi yazdın",
"Özele giriyor aq",
"Adam değilsin sen aq",
"Benim saf bir kalbim var"
],
"bitisSoz": [
"İbo'nun listesi çöpe",
"26k napiyim aq, kazandım"
]
}
];
