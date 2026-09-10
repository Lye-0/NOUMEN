/* NOUMEN · Fictional collection. All distances and observations are imagined. */
(function (root) {
  'use strict';
  const N = root.Noumen = root.Noumen || {};
  N.catalog = Object.freeze([
    {
      id: 'vesper', number: '01', name: 'VESPER', japanese: 'ヴェスパー',
      category: '黒曜天体', classification: 'OBSIDIAN WORLD',
      title: '光が、\n帰ってこない。',
      lead: '反射を終えた光は、どこへ行くのか。',
      description: '地表は、継ぎ目のない黒曜質で覆われている。入射光の99.998%を吸収するが、それに相当する熱放射は確認されていない。輪郭に残る青い光は、恒星光ではない。',
      observation: '無人探査機が投射した光は、到達の8秒前に観測記録から消失した。機器の異常は認められない。',
      facts: [['直径', '18,406 km'], ['反射率', '0.002 %'], ['表面温度', '測定値なし']],
      note: '観測記録 041-A ／ 光学的欠損', accent: '#94bfcc', side: 'left',
      position: [-9.0, -1.2, 3.0], radius: 2.25,
      mobilePosition: [-2.65, 0.6, 2.0], mobileRadius: 1.45,
      camera: { distance: 3.20, offset: [-1.43, .12, 0], yaw: .12, pitch: .06, fov: 44 },
      label: [0, .85]
    },
    {
      id: 'lacuna', number: '02', name: 'LACUNA', japanese: 'ラクーナ',
      category: '断裂天体', classification: 'FRACTURED WORLD',
      title: '崩壊は、\n完了していない。',
      lead: '一瞬が、三千年つづいている。',
      description: '外殻は深部まで断裂し、露出した核が一定の光を放っている。浮遊する地殻片は落下も離散もせず、最初の観測から同じ距離を保つ。この状態を、本館では「崩壊中」と分類している。',
      observation: '断面から回収された鉱物は、採取日より3,200年後に形成されたことを示す。年代測定は、六つの方法で一致した。',
      facts: [['外殻直径', '12,870 km'], ['断裂幅', '1,140 km'], ['崩壊の進行', '検出限界以下']],
      note: '観測記録 017-F ／ 継続する一瞬', accent: '#dfa27c', side: 'left',
      position: [-3.4, 1.2, -5.0], radius: 1.8,
      mobilePosition: [1.7, 2.7, -3.5], mobileRadius: 1.15,
      camera: { distance: 4.4, offset: [-1.35, -.02, 0], yaw: .04, pitch: -.04, fov: 44 },
      label: [.3, .92]
    },
    {
      id: 'orison', number: '03', name: 'ORISON', japanese: 'オリゾン',
      category: '多重環天体', classification: 'RING WORLD',
      title: '環は、\n何かを待っている。',
      lead: '沈黙にも、軌道がある。',
      description: '薄い氷と金属粒子からなる環が、赤道面を幾重にも取り巻く。環の一部は公転方向に逆らって移動しているが、衝突は観測されない。粒子は互いを避けるのではなく、同じ場所を同時に通過する。',
      observation: '環の隙間を数えるたび、結果は一本ずつ増加する。過去の画像を再解析した場合にも、同じ増加が確認される。',
      facts: [['赤道直径', '126,200 km'], ['環の外径', '412,600 km'], ['環の総数', '集計を保留']],
      note: '観測記録 063-R ／ 増加する空白', accent: '#d8c6a3', side: 'left',
      position: [5.5, -1.35, 1.2], radius: 2.7,
      mobilePosition: [1.0, -2.25, -.6], mobileRadius: 1.75,
      camera: { distance: 5.45, offset: [-1.77, .08, 0], yaw: .15, pitch: .12, fov: 46 },
      label: [0, -1.02]
    },
    {
      id: 'gemina', number: '04', name: 'GEMINA', japanese: 'ジェミナ',
      category: '双日照天体', classification: 'TWIN SUNS',
      title: '夜は、\nまだ来ていない。',
      lead: '二つの太陽。ひとつだけの影。',
      description: '琥珀色と青白色の恒星に照らされる岩石惑星。二つの光源は独立した軌道を持つが、地表の物体が落とす影は常に一つである。影の向きは、どちらの恒星の位置とも一致しない。',
      observation: '地表で発見された日時計は、第三の光源を前提としている。該当する恒星は現在まで発見されていない。',
      facts: [['直径', '15,320 km'], ['自転周期', '27.4 時間'], ['完全な夜', '未観測']],
      note: '観測記録 028-D ／ 不在の光源', accent: '#dfb888', side: 'right',
      position: [.8, 6.8, -17.0], radius: 1.65,
      mobilePosition: [-2.4, 5.5, -6.0], mobileRadius: .82,
      camera: { distance: 3.90, offset: [1.5, -.05, 0], yaw: -.08, pitch: .05, fov: 44 },
      label: [.2, .86]
    },
    {
      id: 'vigil', number: '05', name: 'VIGIL', japanese: 'ヴィジル',
      category: '構造物保有天体', classification: 'MEGASTRUCTURE',
      title: '誰も、\n造っていない。',
      lead: '惑星より古い、惑星のための構造物。',
      description: '氷殻の外側を、連続した人工構造物が包囲している。接合部も、動力源も見つかっていない。構造物の年代は中心の惑星より約21億年古く、その内径は惑星の膨張に合わせて変化する。',
      observation: '内壁の開口部は、観測機器の数と常に一致する。新たな探査機を起動すると、対応する開口部が過去の記録にも現れる。',
      facts: [['構造物外径', '91,600 km'], ['建造主体', '該当記録なし'], ['稼働状態', '待機中と推定']],
      note: '観測記録 009-M ／ 応答する不在', accent: '#99c7be', side: 'right',
      position: [12.1, 5.3, -9.0], radius: 1.55,
      mobilePosition: [3.4, 5.5, -9.5], mobileRadius: 1.0,
      camera: { distance: 4.65, offset: [1.70, .10, 0], yaw: -.11, pitch: .06, fov: 44 },
      label: [0, .93]
    }
  ].map(item => Object.freeze(item)));
})(globalThis);
