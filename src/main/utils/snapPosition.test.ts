import { describe, it, expect } from 'vitest';

import { computeSnappedPosition, type Rect } from './snapPosition';

// 作業領域（タスクバーを除いた範囲）
const FHD: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const RIGHT: Rect = { x: 1920, y: 0, width: 1920, height: 1040 };

// 吸着先のウィンドウ（メインウィンドウの例）
const MAIN: Rect = { x: 600, y: 300, width: 400, height: 500 };

/** 大きさ 300×200 のウィンドウを (x, y) に置いたもの */
function at(x: number, y: number): Rect {
  return { x, y, width: 300, height: 200 };
}

describe('computeSnappedPosition', () => {
  describe('ディスプレイの端', () => {
    it('端から 20px 未満なら端に寄せる', () => {
      expect(computeSnappedPosition(at(15, 1040 - 200 - 10), [FHD], [])).toEqual({
        x: 0,
        y: 840,
        snapped: true,
      });
    });

    it('20px 以上離れていれば動かさない', () => {
      expect(computeSnappedPosition(at(20, 500), [FHD], [])).toEqual({
        x: 20,
        y: 500,
        snapped: false,
      });
    });

    it('2 つのディスプレイのうち近いほうの端に寄せる', () => {
      // 右のディスプレイの左端（1920）に近い
      expect(computeSnappedPosition(at(1930, 500), [FHD, RIGHT], []).x).toBe(1920);
      // 左のディスプレイの右端（1920 - 300）に近い
      expect(computeSnappedPosition(at(1610, 500), [FHD, RIGHT], []).x).toBe(1620);
    });

    it('すでに端にあれば snapped は false', () => {
      expect(computeSnappedPosition(at(0, 0), [FHD], []).snapped).toBe(false);
    });
  });

  describe('ほかのウィンドウ', () => {
    it('相手の右にくっつける', () => {
      // 相手の右端は 1000
      expect(computeSnappedPosition(at(1012, 400), [FHD], [MAIN])).toMatchObject({
        x: 1000,
        snapped: true,
      });
    });

    it('相手の左にくっつける', () => {
      // 相手の左端 600 から自分の幅 300 を引いた 300
      expect(computeSnappedPosition(at(290, 400), [FHD], [MAIN]).x).toBe(300);
    });

    it('相手の下と上にくっつける', () => {
      // 相手の下端は 800
      expect(computeSnappedPosition(at(650, 805), [FHD], [MAIN]).y).toBe(800);
      // 相手の上端 300 から自分の高さ 200 を引いた 100
      expect(computeSnappedPosition(at(650, 110), [FHD], [MAIN]).y).toBe(100);
    });

    it('横に並べたとき、上端も近ければ揃える', () => {
      expect(computeSnappedPosition(at(1005, 310), [FHD], [MAIN])).toEqual({
        x: 1000,
        y: 300,
        snapped: true,
      });
    });

    it('横に並べたとき、下端も近ければ揃える', () => {
      // 相手の下端 800 から自分の高さ 200 を引いた 600
      expect(computeSnappedPosition(at(1005, 590), [FHD], [MAIN]).y).toBe(600);
    });

    it('縦に並べたとき、左端・右端も近ければ揃える', () => {
      expect(computeSnappedPosition(at(610, 802), [FHD], [MAIN])).toEqual({
        x: 600,
        y: 800,
        snapped: true,
      });
      // 相手の右端 1000 から自分の幅 300 を引いた 700
      expect(computeSnappedPosition(at(695, 802), [FHD], [MAIN]).x).toBe(700);
    });

    it('縦の範囲が離れていれば、横には吸着しない', () => {
      // 相手の上端 300 より 20px 以上上（下端 80）にあるので、相手の右端 1000 には寄せない
      expect(computeSnappedPosition(at(1005, -120), [], [MAIN]).x).toBe(1005);
    });

    it('縦の範囲が閾値の内側なら、角を合わせて吸着する', () => {
      // 下端 290 は相手の上端 300 の 10px 手前。横は右へ、縦は上にくっつける
      expect(computeSnappedPosition(at(1008, 90), [], [MAIN])).toEqual({
        x: 1000,
        y: 100,
        snapped: true,
      });
    });

    it('ディスプレイの端とウィンドウの両方が近ければ、近いほうに寄せる', () => {
      const nearLeftEdge: Rect = { x: 310, y: 300, width: 400, height: 500 };
      // 相手の左にくっつける位置は 10、ディスプレイの左端は 0。今は 6 なので 10 が近い
      expect(computeSnappedPosition(at(6, 400), [FHD], [nearLeftEdge]).x).toBe(10);
      // 今が 3 ならディスプレイの左端 0 が近い
      expect(computeSnappedPosition(at(3, 400), [FHD], [nearLeftEdge]).x).toBe(0);
    });

    it('複数のウィンドウのうち近いほうに寄せる', () => {
      const other: Rect = { x: 1010, y: 300, width: 300, height: 200 };
      // MAIN の右端 1000 と other の左端 1010 - 300 = 710 のうち、今の 1004 に近い 1000
      expect(computeSnappedPosition(at(1004, 400), [], [MAIN, other]).x).toBe(1000);
    });
  });
});
