#!/usr/bin/env python3
"""Allowlisted FTPS deploy. FTP accounts must be chrooted to each deployment root."""
import argparse
import ftplib
import io
import os
from pathlib import Path
import ssl
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'.html','.css','.js','.json','.txt','.xml','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2','.ico','.ttf','.pdf'}
def manifest(mode):
    if mode == 'portfolio':
        base = ROOT
        names = ['index.html','robots.txt','sitemap.xml']
        names += [p.relative_to(base).as_posix() for p in (base/'assets').rglob('*') if p.is_file()]
    elif mode == 'screenroom-web':
        base = ROOT/'watch'
        names = [p.relative_to(base).as_posix() for p in base.rglob('*') if p.is_file()]
    else:
        base = ROOT/'screenroom-server'
        names = ['app.js','package.json','package-lock.json']
        names += [p.relative_to(base).as_posix() for p in (base/'studio').rglob('*') if p.is_file()]
    result = []
    for name in names:
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or any(x.startswith('.') and x!='.htaccess' for x in path.parts):
            raise RuntimeError('Unsafe path: '+name)
        if path.name=='.htaccess':
            if mode!='screenroom-web':raise RuntimeError('Unexpected .htaccess')
        elif path.suffix.lower() not in ALLOWED:raise RuntimeError('Unexpected file: '+name)
        local = base/path
        if not local.is_file() or local.is_symlink():raise RuntimeError('Invalid file: '+name)
        result.append((name,local))
    return sorted(result,key=lambda x:(x[0]=='app.js',x[0]))

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument('--mode',choices=['portfolio','screenroom-web','screenroom-api'],required=True)
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    files=manifest(args.mode)
    print('Scope:',args.mode,'Files:',len(files))
    if args.dry_run:
        print('\n'.join(name for name,_ in files))
        return
    host=os.environ.get('FTPS_HOST','').strip()
    user=os.environ.get('FTPS_USERNAME','').strip()
    password=os.environ.get('FTPS_PASSWORD','')
    if not all((host,user,password)):raise RuntimeError('Missing FTPS connection secrets')
    if any(x in host for x in ('/','@',':')):raise RuntimeError('Invalid FTPS host')
    ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=40)
    try:
        ftp.connect(host,21)
        ftp.login(user,password)
        ftp.prot_p()
        ftp.set_pasv(True)
        root=ftp.pwd().rstrip('/')
        created=set()
        for name,local in files:
            parts=name.split('/')
            path=root
            for folder in parts[:-1]:
                path+='/'+folder
                if path not in created:
                    try:ftp.mkd(path)
                    except ftplib.error_perm as e:
                        if not str(e).startswith('550'):raise
                    created.add(path)
            with local.open('rb') as stream:
                ftp.storbinary('STOR '+path+'/'+parts[-1],stream)
            print('Uploaded:',name)
        if args.mode=='screenroom-api':
            tmp=root+'/tmp'
            try:ftp.mkd(tmp)
            except ftplib.error_perm as e:
                if not str(e).startswith('550'):raise
            ftp.storbinary('STOR '+tmp+'/restart.txt',io.BytesIO(str(time.time()).encode()))
            print('Passenger restart requested.')
        print('Done. No remote files were deleted.')
    finally:
        try:ftp.quit()
        except Exception:ftp.close()
if __name__=='__main__':
    try:run()
    except Exception as e:
        print('Deploy failed:',type(e).__name__,str(e),file=sys.stderr)
        sys.exit(1)
