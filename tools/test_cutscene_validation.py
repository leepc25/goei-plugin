"""Regression cases for the user's incomplete-folder completion rule."""
import json,tempfile,unittest
from pathlib import Path
from PIL import Image
import build_cutscene_frames as frames

class CompletionRules(unittest.TestCase):
    def setUp(self):
        base=Path(__file__).resolve().parents[1]/'output/validation-tests'
        base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base,prefix='cutscene-')
        self.original=frames.ROOT
        frames.ROOT=Path(self.temp.name)
        self.folder=frames.ROOT/'game-src/art/cutscene/frames/example/c1'
        self.folder.mkdir(parents=True)
        for i in [1,2]:Image.new('RGB',(640,360)).save(self.folder/f'{i:04d}.png')
    def tearDown(self):
        frames.ROOT=self.original
        assert Path(self.temp.name).resolve().is_relative_to(Path(__file__).resolve().parents[1]/'output/validation-tests')
        self.temp.cleanup()
    def timing(self,value):
        (self.folder/'timing.json').write_text(json.dumps(value))
    def valid(self):return frames.check_cut('example/c1')['valid']
    def test_folder_without_timing_is_incomplete(self):self.assertFalse(self.valid())
    def test_more_pngs_than_durations_is_incomplete(self):
        self.timing({'ms':[125]});self.assertFalse(self.valid())
    def test_more_durations_than_pngs_is_incomplete(self):
        self.timing({'ms':[125,125,125]});self.assertFalse(self.valid())
    def test_missing_frame_number_is_incomplete(self):
        (self.folder/'0002.png').rename(self.folder/'0003.png')
        self.timing({'ms':[125,125]});self.assertFalse(self.valid())
    def test_out_of_range_loop_is_incomplete(self):
        self.timing({'ms':[125,125],'loop':[1,3]});self.assertFalse(self.valid())
    def test_complete_cut_passes(self):
        self.timing({'ms':[125,125],'loop':[1,2]});self.assertTrue(self.valid())
    def test_bad_size_is_incomplete(self):
        Image.new('RGB',(10,10)).save(self.folder/'0002.png')
        self.timing({'ms':[125,125]});self.assertFalse(self.valid())

if __name__=='__main__':unittest.main()
