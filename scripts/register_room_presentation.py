"""Register reviewed support planes and composite props without editing pixels.

These corrections only affect illustrated presentation. Canonical furniture,
actor slots, navigation and the approved Z08 arrangement are never rewritten.
"""
import copy


def _instance(records, identity):
    return next(instance for source in records for instance in source['instances']
                if instance['id'] == identity)


def mount_on_source_point(prop, host, point, records):
    """Mount one isolated object on an inspected point of its host's artwork."""
    a, b, c, d, tx, ty = host['artLayers'][0]['matrix']
    sx, sy = point
    anchor = [host['bounds']['x'] + a*sx + c*sy + tx,
              host['bounds']['y'] + b*sx + d*sy + ty]
    original_depth = prop['z']
    prop['bounds'].update(x=anchor[0]-prop['bounds']['width']/2,
                          y=anchor[1]-prop['bounds']['height'])
    prop['z'] = max(prop['z'], host['z']+2)
    instance = _instance(records, prop['id'])
    instance.update(bounds=copy.deepcopy(prop['bounds']), groundAnchor=anchor,
                    support=dict(propIds=[host['id']], sourceImagePoint=list(point),
                                 worldPoint=anchor, originalDepth=original_depth,
                                 presentationDepth=prop['z']))


def apply_room_presentation(assets, records):
    """Mutate the intermediate manifest and its ledger before runtime packing."""
    by_id = {prop['id']: prop for prop in assets['props']}
    lamp, desk = by_id['furniture-169'], by_id['furniture-168']
    if (lamp['sprite'], desk['sprite']) != ('furniture_green_reading_lamp.png', 'furniture_desk.png'):
        raise ValueError('Library lamp support requires the reviewed canonical desk pair')
    # Clear oak at the right end of the original desk, beyond the keyboard.
    mount_on_source_point(lamp, desk, (1150, 350), records)

    represented = []
    for identity, host_id, feature in (
            ('furniture-573', 'furniture-529', 'microscope'),
            ('furniture-661', 'furniture-705', 'test-tube rack')):
        prop, host = by_id[identity], by_id[host_id]
        if host['sprite'] != 'furniture_lab_bench.png' or host.get('zone') != 'Z06':
            raise ValueError('Integrated lab equipment requires its inspected Z06 bench')
        # The delivered lab-bench raster already includes these supported items.
        # Retain their canonical inventory identities in the ledger, rather than
        # draw a second microscope/tube rack unsupported on the floor.
        record = dict(sourcePropId=identity, representedBy=host_id,
                      feature=feature, logicalAnchor=[prop['gx'], prop['gy']],
                      reason='Already depicted on the bench in the original unedited artwork')
        represented.append(record)
        host_instance = _instance(records, host_id)
        host_instance['sourcePropIds'].append(identity)
        host_instance.setdefault('representedProps', []).append(record)
        for source in records:
            source['instances'] = [item for item in source['instances'] if item['id'] != identity]
    suppressed = {record['sourcePropId'] for record in represented}
    assets['props'] = [prop for prop in assets['props'] if prop['id'] not in suppressed]
    records[:] = [source for source in records if source['instances']]

    # This free-standing display belongs against the rear wall. Its canonical
    # cell stays unchanged; moving only the visual base one cell toward that
    # wall separates its face from the independently grounded alert console.
    display = by_id['furniture-523']
    original_bounds = copy.deepcopy(display['bounds'])
    dx, dy = 32, -16
    display['bounds']['x'] += dx
    display['bounds']['y'] += dy
    instance = _instance(records, display['id'])
    instance.update(bounds=copy.deepcopy(display['bounds']),
                    groundAnchor=[instance['groundAnchor'][0]+dx, instance['groundAnchor'][1]+dy],
                    presentationOffset=dict(world=[dx, dy], visualGridAnchor=[39, 10],
                                            originalBounds=original_bounds,
                                            reason='Mount the display along the Z12 rear-wall line'))
    assets['props'].sort(key=lambda prop: (prop['z'], prop['id']))
    return dict(representedProps=represented, sourcePixelsEdited=False,
                logicalLayoutChanged=False, actorSlotsChanged=False, browserVisualQA=False)
