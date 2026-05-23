import subprocess, os, sys, time, signal

def main():
    os.chdir('/home/z/my-project')
    env = os.environ.copy()
    env['DATABASE_URL'] = 'postgresql://staysuite:Staysuite2025@localhost:5432/staysuite'
    
    while True:
        proc = subprocess.Popen(
            ['npx', 'next', 'dev', '-p', '3000', '--webpack'],
            env=env,
            stdout=open('/home/z/my-project/dev.log', 'a'),
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid  # Create new session
        )
        proc.wait()
        time.sleep(3)

if __name__ == '__main__':
    main()
