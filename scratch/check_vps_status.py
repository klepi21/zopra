import paramiko

host = "43.165.6.212"
user = "ubuntu"
password = "~5@R8gHTe,2a"

try:
    print("Connecting to VPS...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=10)
    print("Connected successfully!\n")

    # Run docker ps
    stdin, stdout, stderr = ssh.exec_command("sudo -S docker ps", get_pty=True)
    stdin.write(password + "\n")
    stdin.flush()
    print("--- [sudo docker ps] ---")
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    # Run docker logs
    stdin, stdout, stderr = ssh.exec_command("sudo -S docker logs zopra-server --tail 50", get_pty=True)
    stdin.write(password + "\n")
    stdin.flush()
    print("--- [zopra-server logs] ---")
    print(stdout.read().decode('utf-8'))

    ssh.close()
except Exception as e:
    print(f"Error: {e}")
