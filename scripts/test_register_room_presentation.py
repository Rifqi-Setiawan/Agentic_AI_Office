"""Offline support-plane and inventory registration tests, not browser QA."""
import copy
import unittest

from register_room_presentation import apply_room_presentation, mount_on_source_point


def prop(identity, sprite, zone='Z06'):
    return dict(id=identity, sprite=sprite, zone=zone, gx=1, gy=12, x=736, y=272, z=13010,
                bounds=dict(x=100, y=200, width=72, height=60),
                artLayers=[dict(matrix=[.1, 0, 0, .1, -20, -5])])


def fixture():
    props = [prop('furniture-169', 'furniture_green_reading_lamp.png', 'Z05'),
             prop('furniture-168', 'furniture_desk.png', 'Z05'),
             prop('furniture-573', 'furniture_microscope.png'),
             prop('furniture-529', 'furniture_lab_bench.png'),
             prop('furniture-661', 'furniture_test_tube_rack.png'),
             prop('furniture-705', 'furniture_lab_bench.png'),
             prop('furniture-523', 'furniture_soc_map_wall.png', 'Z12'),
             prop('approved-z08', 'furniture_desk.png', 'Z08')]
    records = [dict(instances=[dict(id=p['id'], sourcePropIds=[p['id']],
                                   bounds=copy.deepcopy(p['bounds']), groundAnchor=[136, 260])])
               for p in props]
    return dict(props=props), records


class RoomPresentationTest(unittest.TestCase):
    def test_measured_support_point_uses_host_matrix_and_draws_above_support(self):
        assets, records = fixture()
        lamp, desk = assets['props'][:2]
        desk['z'] = lamp['z']+100
        before = copy.deepcopy(lamp)
        mount_on_source_point(lamp, desk, (1150, 350), records)
        support = records[0]['instances'][0]['support']
        self.assertEqual(support['worldPoint'], [195, 230])
        self.assertEqual([lamp['bounds']['x']+lamp['bounds']['width']/2,
                          lamp['bounds']['y']+lamp['bounds']['height']], [195, 230])
        self.assertEqual(support['originalDepth'], before['z'])
        self.assertEqual(lamp['z'], desk['z']+2)
        self.assertEqual(lamp['artLayers'], before['artLayers'])

    def test_lab_equipment_ids_are_represented_once_by_existing_benches(self):
        assets, records = fixture()
        ledger = apply_room_presentation(assets, records)
        for identity, host in (('furniture-573', 'furniture-529'), ('furniture-661', 'furniture-705')):
            self.assertNotIn(identity, [p['id'] for p in assets['props']])
            instances = [i for source in records for i in source['instances'] if identity in i['sourcePropIds']]
            self.assertEqual(len(instances), 1)
            self.assertEqual(instances[0]['id'], host)
            self.assertEqual(next(p for p in ledger['representedProps'] if p['sourcePropId'] == identity)['representedBy'], host)
        self.assertEqual(len(assets['props']), 6)

    def test_only_visual_bounds_and_support_depth_change(self):
        assets, records = fixture()
        originals = {p['id']: copy.deepcopy(p) for p in assets['props']}
        ledger = apply_room_presentation(assets, records)
        for p in assets['props']:
            for key in ('id', 'sprite', 'gx', 'gy', 'x', 'y', 'artLayers'):
                self.assertEqual(p[key], originals[p['id']][key])
        self.assertEqual(next(p for p in assets['props'] if p['id'] == 'approved-z08'), originals['approved-z08'])
        self.assertFalse(ledger['logicalLayoutChanged'])
        self.assertFalse(ledger['actorSlotsChanged'])
        self.assertFalse(ledger['sourcePixelsEdited'])
        self.assertFalse(ledger['browserVisualQA'])

    def test_soc_map_moves_one_visual_cell_toward_rear_wall_without_depth_change(self):
        assets, records = fixture()
        original = copy.deepcopy(next(p for p in assets['props'] if p['id'] == 'furniture-523'))
        apply_room_presentation(assets, records)
        current = next(p for p in assets['props'] if p['id'] == 'furniture-523')
        self.assertEqual(current['bounds'], dict(x=132, y=184, width=72, height=60))
        self.assertEqual(current['z'], original['z'])

    def test_wrong_library_support_fails_instead_of_mounting_on_arbitrary_furniture(self):
        assets, records = fixture()
        assets['props'][1]['sprite'] = 'furniture_bookcase_tall.png'
        with self.assertRaisesRegex(ValueError, 'reviewed canonical desk pair'):
            apply_room_presentation(assets, records)


if __name__ == '__main__':
    unittest.main()
