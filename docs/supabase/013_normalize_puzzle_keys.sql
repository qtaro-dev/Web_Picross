-- Ticket 142: normalize legacy puzzle_key values.
-- Apply manually from Supabase SQL Editor after checking the SELECT results.
-- This updates only public.puzzles.puzzle_key. UUID primary keys in puzzles.id are not changed.

-- Before update: confirm the rows that still use legacy keys or mismatched keys.
select id, puzzle_key, difficulty, stage_no, title, color_mode
from public.puzzles
where (difficulty = 'beginner' and stage_no = 3 and puzzle_key = 'beginner_color_id00000003')
   or (difficulty = 'easy' and stage_no = 1 and puzzle_key = '1')
   or (difficulty = 'easy' and stage_no = 2 and puzzle_key = '2')
   or (difficulty = 'normal' and stage_no = 1 and puzzle_key = '1')
   or (difficulty = 'normal' and stage_no = 2 and puzzle_key = '2')
   or (difficulty = 'hard' and stage_no = 1 and puzzle_key = '1')
   or (difficulty = 'hard' and stage_no = 2 and puzzle_key = '2')
   or (difficulty = 'endless' and stage_no = 1 and puzzle_key = '1')
   or (difficulty = 'endless' and stage_no = 2 and puzzle_key = '2')
order by difficulty, stage_no;

begin;

update public.puzzles
set puzzle_key = 'beginner_mono_id00000003'
where difficulty = 'beginner'
  and stage_no = 3
  and title = 'やじるし'
  and color_mode = 'mono'
  and puzzle_key = 'beginner_color_id00000003';

update public.puzzles
set puzzle_key = 'easy_mono_id00000001'
where difficulty = 'easy'
  and stage_no = 1
  and title = 'パズル 1'
  and color_mode = 'mono'
  and puzzle_key = '1';

update public.puzzles
set puzzle_key = 'easy_mono_id00000002'
where difficulty = 'easy'
  and stage_no = 2
  and title = 'パズル 2'
  and color_mode = 'mono'
  and puzzle_key = '2';

update public.puzzles
set puzzle_key = 'normal_mono_id00000001'
where difficulty = 'normal'
  and stage_no = 1
  and title = 'とけい'
  and color_mode = 'mono'
  and puzzle_key = '1';

update public.puzzles
set puzzle_key = 'normal_color_id00000002'
where difficulty = 'normal'
  and stage_no = 2
  and title = 'ひこうき'
  and color_mode = 'color'
  and puzzle_key = '2';

update public.puzzles
set puzzle_key = 'hard_mono_id00000001'
where difficulty = 'hard'
  and stage_no = 1
  and title = 'キャラクター'
  and color_mode = 'mono'
  and puzzle_key = '1';

update public.puzzles
set puzzle_key = 'hard_color_id00000002'
where difficulty = 'hard'
  and stage_no = 2
  and title = 'サボテン'
  and color_mode = 'color'
  and puzzle_key = '2';

update public.puzzles
set puzzle_key = 'endless_mono_id00000001'
where difficulty = 'endless'
  and stage_no = 1
  and title = '大文字焼きと月'
  and color_mode = 'mono'
  and puzzle_key = '1';

update public.puzzles
set puzzle_key = 'endless_color_id00000002'
where difficulty = 'endless'
  and stage_no = 2
  and title = 'フェニックス'
  and color_mode = 'color'
  and puzzle_key = '2';

commit;

-- After update: all rows should show normalized puzzle_key values.
select id, puzzle_key, difficulty, stage_no, title, color_mode
from public.puzzles
where (difficulty = 'beginner' and stage_no = 3)
   or (difficulty = 'easy' and stage_no in (1, 2))
   or (difficulty = 'normal' and stage_no in (1, 2))
   or (difficulty = 'hard' and stage_no in (1, 2))
   or (difficulty = 'endless' and stage_no in (1, 2))
order by difficulty, stage_no;
