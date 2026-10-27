"""Parse candidate text as data; never import/execute a candidate generator.

Only the three catalog introduction paragraphs reviewed in PR24 may vary.
Formatted expressions, output paths, inventory logic and every other AST node
must remain identical. New slots require a reviewed CI policy change.
"""
import ast
import json
import sys

def normalized(source):
    tree = ast.parse(source)
    found = []
    for node in tree.body:
        target = node.targets[0] if isinstance(node, ast.Assign) and len(node.targets) == 1 else node.target if isinstance(node, ast.AugAssign) else None
        if not isinstance(target, ast.Name) or not isinstance(node.value, ast.List):
            continue
        slot = None
        if isinstance(node, ast.Assign) and target.id in ('schema', 'feature_doc'):
            slot = 2
        if isinstance(node, ast.AugAssign) and target.id == 'schema' and len(node.value.elts) == 4 and isinstance(node.value.elts[1], ast.Constant) and node.value.elts[1].value == '## DS-2026-10-17 hedef depolama bağımlılıkları':
            slot = 3
        if slot is None:
            continue
        paragraph = node.value.elts[slot]
        if isinstance(paragraph, ast.Constant) and isinstance(paragraph.value, str):
            paragraph.value = '<reviewed documentation paragraph>'
        elif isinstance(paragraph, ast.JoinedStr):
            for part in paragraph.values:
                if isinstance(part, ast.Constant) and isinstance(part.value, str):
                    part.value = '<reviewed documentation paragraph>'
        else:
            raise ValueError('Unknown paragraph structure')
        found.append(target.id)
    if sorted(found) != ['feature_doc', 'schema', 'schema']:
        raise ValueError('Reviewed slots missing/duplicated')
    return ast.dump(tree, include_attributes=False)

if __name__ == '__main__':
    pair = json.load(sys.stdin)
    print(json.dumps({'safe': normalized(pair['base']) == normalized(pair['head'])}))
