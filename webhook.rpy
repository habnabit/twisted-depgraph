# -*- python -*-
import hashlib
import hmac
import json
import os

import treq
from twisted.internet import defer
from twisted.python import log
from twisted.web.resource import Resource


GITHUB_CLIENT_SECRET = os.environ['GITHUB_CLIENT_SECRET']
TRAVIS_AUTH_TOKEN = os.environ['TRAVIS_AUTH_TOKEN']


class BadSignature(Exception):
    pass


def _verifySignatureAndDecode(request):
    signature = request.getHeader('X-Hub-Signature')
    if not signature:
        raise BadSignature('no signature present')
    _, _, signature = signature.partition('sha1=')
    if not signature:
        raise BadSignature('bad signature format')
    data = request.content.read()
    digest = hmac.new(GITHUB_CLIENT_SECRET, digestmod=hashlib.sha1)
    digest.update(data)
    if digest.hexdigest() != signature:
        raise BadSignature('signature mismatch')
    return json.loads(data)


class BadHTTPResponse(Exception):
    pass


def _trapBadStatuses(response):
    if response.code // 100 != 2:
        raise BadHTTPResponse(response.code)


@defer.inlineCallbacks
def _triggerTravisBuild():
    resp = yield treq.get(
        'https://api.travis-ci.org/repos/habnabit/twisted-depgraph/builds')
    data = yield treq.json_content(resp)
    _trapBadStatuses(resp)
    build_id = data[0]['id']
    resp = yield treq.post(
        'https://api.travis-ci.org/builds/%s/restart' % (build_id,),
        headers={
            'Authorization': 'token %s' % (TRAVIS_AUTH_TOKEN,),
        })
    yield treq.collect(resp, lambda ign: None)
    _trapBadStatuses(resp)
    log.msg('rebuilt %r' % (build_id,))


class HookResource(Resource):
    def render_POST(self, request):
        event = request.getHeader('X-Github-Event')
        delivery = request.getHeader('X-Github-Delivery')
        log.msg('event: %r; delivery: %r' % (event, delivery))
        if event != 'push':
            return ''
        data = _verifySignatureAndDecode(request)
        if data['ref'] != 'refs/heads/trunk':
            return ''
        log.msg('trunk HEAD: %s' % (data['after'][:7],))
        d = _triggerTravisBuild()
        d.addErrback(log.err, 'error on delivery %r' % (delivery,))
        return ''


resource = HookResource()
