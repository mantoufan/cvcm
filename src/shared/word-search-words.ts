/**
 * Word search lists, written for cv.cm: eight themes per page language, comma-separated, as readers spell them.
 * The grid form drops spaces, hyphens and accents (Spanish keeps Ñ, Vietnamese Đ becomes D), see `gridLetters` in
 * word-search.ts; Chinese, Japanese (katakana) and Korean (Hangul) words go into the grid one character per cell.
 */
import type { Locale } from "./locale";

export const WS_THEMES = ["animals", "food", "nature", "sports", "home", "school", "body", "jobs"] as const;
export type WsTheme = (typeof WS_THEMES)[number];

export const WS_WORDS: Record<Locale, Record<WsTheme, string>> = {
  en: {
    animals: "cat, dog, horse, tiger, lion, zebra, monkey, rabbit, turtle, panda, koala, sheep, goat, eagle, owl, whale, dolphin, snake, frog, mouse, giraffe, penguin, duck, bear, fox, camel",
    food: "apple, banana, bread, cheese, pizza, pasta, rice, soup, salad, mango, grape, lemon, orange, carrot, tomato, cookie, honey, butter, noodle, peach, cherry, potato, onion, melon",
    nature: "river, ocean, forest, mountain, desert, island, flower, tree, leaf, cloud, rain, snow, storm, rainbow, valley, lake, beach, stone, grass, sunset, wind, moon, star, waterfall",
    sports: "soccer, tennis, hockey, golf, rugby, chess, skiing, rowing, boxing, cycling, karate, baseball, handball, surfing, diving, archery, skating, running, cricket, judo, volleyball, swimming",
    home: "table, chair, sofa, lamp, door, window, kitchen, pillow, blanket, mirror, shelf, carpet, oven, clock, curtain, bathtub, garden, roof, stairs, drawer, bed, fridge",
    school: "pencil, eraser, ruler, book, desk, teacher, lesson, science, history, music, art, paper, crayon, scissors, backpack, library, math, class, notebook, globe, chalk, exam",
    body: "head, hand, foot, knee, elbow, shoulder, finger, thumb, ankle, heart, nose, mouth, tooth, ear, eye, chin, cheek, wrist, neck, brain, back, toe",
    jobs: "doctor, nurse, teacher, pilot, farmer, baker, chef, dentist, artist, writer, singer, dancer, driver, painter, lawyer, plumber, tailor, barber, cashier, florist, architect, engineer",
  },
  es: {
    animals: "gato, perro, caballo, tigre, león, cebra, mono, conejo, tortuga, oso, panda, koala, oveja, cabra, águila, búho, ballena, delfín, serpiente, rana, ratón, jirafa, pingüino, pato, zorro, elefante",
    food: "manzana, plátano, pan, queso, pizza, arroz, sopa, ensalada, mango, uva, limón, naranja, zanahoria, tomate, galleta, miel, fideos, cereza, papa, cebolla, melón, piña, fresa",
    nature: "río, océano, bosque, montaña, desierto, isla, flor, árbol, hoja, nube, lluvia, nieve, tormenta, arcoíris, valle, lago, playa, piedra, hierba, viento, luna, estrella, cascada",
    sports: "fútbol, tenis, hockey, golf, rugby, ajedrez, esquí, remo, boxeo, ciclismo, kárate, béisbol, balonmano, surf, buceo, natación, patinaje, atletismo, judo, voleibol, baloncesto",
    home: "mesa, silla, sofá, lámpara, puerta, ventana, cocina, almohada, manta, espejo, estante, alfombra, horno, reloj, cortina, bañera, jardín, techo, escalera, cajón, cama, nevera",
    school: "lápiz, goma, regla, libro, pupitre, maestro, lección, ciencia, historia, música, arte, papel, tijeras, mochila, biblioteca, clase, cuaderno, globo, pizarra, examen, tiza",
    body: "cabeza, mano, pie, rodilla, codo, hombro, dedo, pulgar, tobillo, corazón, nariz, boca, diente, oreja, ojo, barbilla, mejilla, muñeca, cuello, cerebro, espalda",
    jobs: "médico, enfermero, maestro, piloto, granjero, panadero, cocinero, dentista, artista, escritor, cantante, bailarín, conductor, pintor, abogado, bombero, fontanero, sastre, barbero, cajero, florista, pescador",
  },
  id: {
    animals: "kucing, anjing, kuda, harimau, singa, zebra, monyet, kelinci, kura-kura, panda, koala, domba, kambing, elang, paus, ular, katak, tikus, jerapah, penguin, bebek, beruang, rubah, gajah, unta",
    food: "apel, pisang, roti, keju, pizza, nasi, sup, salad, mangga, anggur, lemon, jeruk, wortel, tomat, kue, madu, mentega, ceri, kentang, bawang, semangka, nanas, bakso, sate",
    nature: "sungai, laut, hutan, gunung, gurun, pulau, bunga, pohon, daun, awan, hujan, salju, badai, pelangi, lembah, danau, pantai, batu, rumput, angin, bulan, bintang, bukit",
    sports: "sepak bola, tenis, hoki, golf, rugbi, catur, ski, dayung, tinju, bersepeda, karate, bisbol, renang, selancar, menyelam, panahan, lari, bulu tangkis, voli, judo, basket, senam",
    home: "meja, kursi, sofa, lampu, pintu, jendela, dapur, bantal, selimut, cermin, rak, karpet, oven, jam, tirai, taman, atap, tangga, laci, kasur, lemari, kulkas",
    school: "pensil, penghapus, penggaris, buku, guru, pelajaran, sains, sejarah, musik, seni, kertas, krayon, gunting, tas, perpustakaan, kelas, matematika, papan tulis, ujian, kapur, bangku",
    body: "kepala, tangan, kaki, lutut, siku, bahu, jari, jempol, jantung, hidung, mulut, gigi, telinga, mata, dagu, pipi, leher, otak, perut, punggung, rambut",
    jobs: "dokter, perawat, guru, pilot, petani, koki, seniman, penulis, penyanyi, penari, sopir, pelukis, pengacara, polisi, penjahit, kasir, nelayan, arsitek, insinyur, montir, wartawan, pelaut",
  },
  vi: {
    animals: "mèo, chó, ngựa, khỉ, thỏ, rùa, cừu, ếch, chuột, vịt, gấu, cáo, voi, rắn, sư tử, ngựa vằn, gấu trúc, đại bàng, cú mèo, cá voi, cá heo, hươu cao cổ, chim cánh cụt, lạc đà",
    food: "táo, chuối, bánh mì, phô mai, cơm, phở, canh, xoài, nho, chanh, cam, cà rốt, cà chua, bánh quy, mật ong, đào, khoai tây, bánh bao, nem rán, chè, xôi, dưa hấu",
    nature: "sông, biển, rừng, núi, sa mạc, hòn đảo, hoa, cây, mây, mưa, tuyết, bão, cầu vồng, thung lũng, bãi biển, gió, mặt trăng, ngôi sao, thác nước, đồi núi, mặt trời",
    sports: "bóng đá, quần vợt, đánh gôn, cờ vua, trượt tuyết, chèo thuyền, quyền anh, đạp xe, karate, bóng chày, bóng ném, lướt sóng, lặn, bơi lội, trượt băng, chạy bộ, cầu lông, bóng chuyền, bóng rổ, võ thuật",
    home: "bàn, ghế, sofa, đèn, cửa, cửa sổ, nhà bếp, gối, chăn, gương, thảm, lò nướng, đồng hồ, rèm cửa, bồn tắm, khu vườn, mái nhà, cầu thang, ngăn kéo, giường, tủ lạnh",
    school: "bút chì, cục tẩy, thước kẻ, quyển sách, bàn học, giáo viên, bài học, khoa học, lịch sử, âm nhạc, mỹ thuật, giấy, bút sáp, kéo, ba lô, thư viện, toán, lớp học, vở, bảng đen, bài kiểm tra",
    body: "đầu, bàn tay, bàn chân, đầu gối, khuỷu tay, vai, ngón tay, ngón cái, tim, mũi, miệng, răng, tai, mắt, cằm, cổ tay, não, bụng, lưng, tóc",
    jobs: "bác sĩ, y tá, giáo viên, phi công, nông dân, đầu bếp, nha sĩ, họa sĩ, nhà văn, ca sĩ, vũ công, tài xế, thợ sơn, luật sư, cảnh sát, thợ may, thợ cắt tóc, thu ngân, ngư dân, kiến trúc sư, kỹ sư",
  },
  "zh-CN": {
    animals: "老虎, 狮子, 斑马, 猴子, 兔子, 乌龟, 熊猫, 考拉, 绵羊, 山羊, 老鹰, 猫头鹰, 鲸鱼, 海豚, 青蛙, 老鼠, 长颈鹿, 企鹅, 鸭子, 狐狸, 大象, 骆驼, 松鼠, 孔雀",
    food: "苹果, 香蕉, 面包, 奶酪, 披萨, 米饭, 汤圆, 沙拉, 芒果, 葡萄, 柠檬, 橙子, 胡萝卜, 西红柿, 饼干, 蜂蜜, 黄油, 面条, 桃子, 樱桃, 土豆, 饺子, 包子",
    nature: "河流, 大海, 森林, 高山, 沙漠, 岛屿, 花朵, 大树, 树叶, 白云, 下雨, 雪花, 暴风雨, 彩虹, 山谷, 湖泊, 海滩, 石头, 草地, 月亮, 星星, 瀑布, 微风",
    sports: "足球, 网球, 冰球, 高尔夫, 橄榄球, 象棋, 滑雪, 划船, 拳击, 骑车, 空手道, 棒球, 手球, 冲浪, 潜水, 射箭, 滑冰, 跑步, 羽毛球, 排球, 篮球, 乒乓球",
    home: "桌子, 椅子, 沙发, 台灯, 房门, 窗户, 厨房, 枕头, 毯子, 镜子, 书架, 地毯, 烤箱, 时钟, 窗帘, 浴缸, 花园, 屋顶, 楼梯, 抽屉, 床单, 冰箱",
    school: "铅笔, 橡皮, 尺子, 课本, 书桌, 老师, 课堂, 科学, 历史, 音乐, 美术, 纸张, 蜡笔, 剪刀, 书包, 图书馆, 数学, 班级, 笔记本, 地球仪, 黑板, 考试",
    body: "头发, 双手, 脚掌, 膝盖, 手肘, 肩膀, 手指, 拇指, 脚踝, 心脏, 鼻子, 嘴巴, 牙齿, 耳朵, 眼睛, 下巴, 脸颊, 手腕, 脖子, 大脑, 肚子",
    jobs: "医生, 护士, 老师, 飞行员, 农民, 面包师, 厨师, 牙医, 画家, 作家, 歌手, 舞蹈家, 司机, 油漆工, 律师, 警察, 消防员, 裁缝, 理发师, 收银员, 渔民, 建筑师",
  },
  "zh-TW": {
    animals: "老虎, 獅子, 斑馬, 猴子, 兔子, 烏龜, 熊貓, 無尾熊, 綿羊, 山羊, 老鷹, 貓頭鷹, 鯨魚, 海豚, 青蛙, 老鼠, 長頸鹿, 企鵝, 鴨子, 狐狸, 大象, 駱駝, 松鼠, 孔雀",
    food: "蘋果, 香蕉, 麵包, 起司, 披薩, 米飯, 湯圓, 沙拉, 芒果, 葡萄, 檸檬, 柳橙, 紅蘿蔔, 番茄, 餅乾, 蜂蜜, 奶油, 麵條, 桃子, 櫻桃, 馬鈴薯, 水餃, 包子",
    nature: "河流, 大海, 森林, 高山, 沙漠, 島嶼, 花朵, 大樹, 樹葉, 白雲, 下雨, 雪花, 暴風雨, 彩虹, 山谷, 湖泊, 海灘, 石頭, 草地, 月亮, 星星, 瀑布, 微風",
    sports: "足球, 網球, 冰球, 高爾夫, 橄欖球, 象棋, 滑雪, 划船, 拳擊, 騎車, 空手道, 棒球, 手球, 衝浪, 潛水, 射箭, 溜冰, 跑步, 羽毛球, 排球, 籃球, 桌球",
    home: "桌子, 椅子, 沙發, 檯燈, 房門, 窗戶, 廚房, 枕頭, 毯子, 鏡子, 書架, 地毯, 烤箱, 時鐘, 窗簾, 浴缸, 花園, 屋頂, 樓梯, 抽屜, 床單, 冰箱",
    school: "鉛筆, 橡皮擦, 直尺, 課本, 書桌, 老師, 課堂, 科學, 歷史, 音樂, 美術, 紙張, 蠟筆, 剪刀, 書包, 圖書館, 數學, 班級, 筆記本, 地球儀, 黑板, 考試",
    body: "頭髮, 雙手, 腳掌, 膝蓋, 手肘, 肩膀, 手指, 拇指, 腳踝, 心臟, 鼻子, 嘴巴, 牙齒, 耳朵, 眼睛, 下巴, 臉頰, 手腕, 脖子, 大腦, 肚子",
    jobs: "醫生, 護理師, 老師, 飛行員, 農夫, 麵包師, 廚師, 牙醫, 畫家, 作家, 歌手, 舞蹈家, 司機, 油漆工, 律師, 警察, 消防員, 裁縫師, 理髮師, 收銀員, 漁夫, 建築師",
  },
  ja: {
    animals: "ネコ, イヌ, ウマ, トラ, ライオン, シマウマ, サル, ウサギ, カメ, パンダ, コアラ, ヒツジ, ヤギ, ワシ, フクロウ, クジラ, イルカ, ヘビ, カエル, ネズミ, キリン, ペンギン, アヒル, クマ, キツネ, ゾウ",
    food: "リンゴ, バナナ, パン, チーズ, ピザ, パスタ, スープ, サラダ, マンゴー, ブドウ, レモン, オレンジ, ニンジン, トマト, クッキー, ハチミツ, バター, ラーメン, モモ, サクランボ, ジャガイモ, ギョウザ",
    nature: "カワ, ウミ, モリ, ヤマ, サバク, シマ, ハナ, クモ, アメ, ユキ, アラシ, ニジ, タニ, ミズウミ, ハマベ, イシ, クサ, ツキ, ホシ, タキ, カゼ, タイヨウ",
    sports: "サッカー, テニス, ホッケー, ゴルフ, ラグビー, スキー, ボクシング, カラテ, ヤキュウ, ハンドボール, サーフィン, ダイビング, スケート, マラソン, ジュウドウ, バレーボール, バスケット, バドミントン, スイエイ, タッキュウ",
    home: "テーブル, イス, ソファ, ランプ, ドア, マド, キッチン, マクラ, モウフ, カガミ, タナ, カーペット, オーブン, トケイ, カーテン, フロ, ニワ, ヤネ, カイダン, ベッド, レイゾウコ",
    school: "エンピツ, ケシゴム, ジョウギ, ツクエ, センセイ, ジュギョウ, リカ, レキシ, オンガク, ビジュツ, カミ, クレヨン, ハサミ, ランドセル, トショカン, サンスウ, クラス, ノート, コクバン, テスト",
    body: "アタマ, ヒザ, ヒジ, カタ, ユビ, オヤユビ, アシクビ, シンゾウ, ハナ, クチ, ミミ, アゴ, テクビ, クビ, オナカ, セナカ, カミノケ, マユゲ, ツメ, ホホ",
    jobs: "イシャ, カンゴシ, センセイ, パイロット, ノウカ, パンヤ, シェフ, ハイシャ, ガカ, サッカ, カシュ, ダンサー, ウンテンシュ, ベンゴシ, ケイサツカン, ショウボウシ, ビヨウシ, リョウシ, ケンチクカ, エンジニア",
  },
  ko: {
    animals: "고양이, 강아지, 호랑이, 사자, 얼룩말, 원숭이, 토끼, 거북이, 판다, 코알라, 염소, 독수리, 부엉이, 고래, 돌고래, 개구리, 생쥐, 기린, 펭귄, 오리, 여우, 코끼리, 낙타, 다람쥐",
    food: "사과, 바나나, 치즈, 피자, 파스타, 수프, 샐러드, 망고, 포도, 레몬, 오렌지, 당근, 토마토, 쿠키, 버터, 국수, 복숭아, 체리, 감자, 만두, 김밥, 떡볶이, 수박",
    nature: "바다, 강물, 숲속, 사막, 무지개, 구름, 소나기, 눈송이, 태풍, 계곡, 호수, 해변, 돌멩이, 잔디, 바람, 달빛, 별빛, 폭포, 꽃잎, 나무, 나뭇잎, 햇살",
    sports: "축구, 테니스, 하키, 골프, 럭비, 체스, 스키, 권투, 자전거, 태권도, 야구, 핸드볼, 서핑, 다이빙, 양궁, 스케이트, 달리기, 배드민턴, 배구, 농구, 탁구, 수영",
    home: "식탁, 의자, 소파, 전등, 현관문, 창문, 부엌, 베개, 담요, 거울, 책장, 카펫, 오븐, 시계, 커튼, 욕조, 정원, 지붕, 계단, 서랍, 침대, 냉장고",
    school: "연필, 지우개, 교과서, 책상, 선생님, 수업, 과학, 역사, 음악, 미술, 종이, 크레파스, 가위, 가방, 도서관, 수학, 교실, 공책, 지구본, 칠판, 시험, 분필",
    body: "머리, 손가락, 발목, 무릎, 팔꿈치, 어깨, 엄지, 심장, 입술, 이마, 눈썹, 손목, 두뇌, 배꼽, 허리, 다리, 발가락, 손바닥, 머리카락, 어깨뼈",
    jobs: "의사, 간호사, 선생님, 조종사, 농부, 제빵사, 요리사, 치과의사, 화가, 작가, 가수, 무용가, 운전사, 변호사, 경찰관, 소방관, 재단사, 미용사, 계산원, 어부, 건축가, 기술자",
  },
};
