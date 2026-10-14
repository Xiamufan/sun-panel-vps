import importlib.util,json,tempfile,pathlib,unittest,io,contextlib
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('wallpapers',pathlib.Path(__file__).resolve().parents[1]/'grow-wallpapers.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class WallpaperTests(unittest.TestCase):
    def test_offline_refresh_filters_persists_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            base=pathlib.Path(directory)
            custom=base/'conf/custom'; custom.mkdir(parents=True)
            image={'id':'ab1234','dimension_x':3840,'dimension_y':2160,'path':'https://w.wallhaven.cc/full/ab/wallhaven-ab1234.jpg','purity':'sfw','file_type':'image/jpeg','resolution':'3840x2160','url':'https://wallhaven.cc/w/ab1234'}
            rejected=dict(image,id='cd1234',purity='nsfw',path='https://w.wallhaven.cc/full/cd/wallhaven-cd1234.jpg')
            data={'data':[image,rejected],'meta':{'last_page':1}}
            def response(*args,**kwargs): return io.StringIO(json.dumps(data))
            with patch.multiple(module,BASE=base,ROOT=custom,CATALOG=custom/'hd-wallpapers.json',STATE=base/'wallpaper-state.json',REPORT=custom/'wallpaper-update.json'), patch.object(module.urllib.request,'urlopen',side_effect=response),patch.object(module.time,'sleep'),patch('sys.argv',['grow-wallpapers.py']),contextlib.redirect_stdout(io.StringIO()):
                module.main()
                module.main()
            catalog=json.loads((custom/'hd-wallpapers.json').read_text())
            self.assertEqual(len(catalog),1)
            self.assertEqual(len(catalog[0]['topics']),11)
            self.assertEqual(json.loads((custom/'wallpaper-update.json').read_text())['added'],0)
            self.assertTrue(json.loads((base/'wallpaper-state.json').read_text())['last_success'])

if __name__=='__main__': unittest.main()
