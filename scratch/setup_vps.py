import os
import sys
import paramiko

host = "43.165.6.212"
user = "ubuntu"
password = "~5@R8gHTe,2a"
local_project_root = "/Users/konstantinoslepidas/quizdin"
remote_target_dir = "/home/ubuntu/zopra"

def run_sudo_cmd(client, command, sudo_pass):
    print(f"\n[Command] Running: {command}")
    stdin, stdout, stderr = client.exec_command(command, get_pty=True)
    stdin.write(sudo_pass + "\n")
    stdin.flush()
    # Wait for the command to finish
    exit_status = stdout.channel.recv_exit_status()
    out_str = stdout.read().decode('utf-8', errors='ignore')
    err_str = stderr.read().decode('utf-8', errors='ignore')
    print(out_str)
    if exit_status != 0:
        print(f"Error executing command. Exit code: {exit_status}")
        print(err_str)
    return exit_status

try:
    print("Connecting to VPS via SSH (43.165.6.212)...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=30)
    print("Successfully connected!")

    # Check if docker is installed
    stdin, stdout, stderr = ssh.exec_command("docker --version")
    if stdout.channel.recv_exit_status() != 0:
        print("\nDocker not found. Installing Docker, Docker Compose...")
        run_sudo_cmd(ssh, "sudo -S apt-get update", password)
        run_sudo_cmd(ssh, "sudo -S apt-get install -y docker.io docker-compose-v2", password)
        run_sudo_cmd(ssh, "sudo -S systemctl start docker", password)
        run_sudo_cmd(ssh, "sudo -S systemctl enable docker", password)
    else:
        print("\nDocker is already installed.")

    # Configure firewall
    print("\nOpening port 3000 on the firewall...")
    run_sudo_cmd(ssh, "sudo -S ufw allow 3000/tcp", password)

    # Ensure remote directory exists
    print("\nCreating remote directories...")
    ssh.exec_command(f"mkdir -p {remote_target_dir}")
    ssh.exec_command(f"mkdir -p {remote_target_dir}/server")

    # Start SFTP
    print("\nStarting SFTP connection...")
    sftp = ssh.open_sftp()

    # Upload docker-compose.yml
    local_dc = os.path.join(local_project_root, "docker-compose.yml")
    remote_dc = os.path.join(remote_target_dir, "docker-compose.yml")
    print(f"Uploading: {local_dc} -> {remote_dc}")
    sftp.put(local_dc, remote_dc)

    # Upload local server .env as remote root .env
    local_env = os.path.join(local_project_root, "server", ".env")
    remote_env = os.path.join(remote_target_dir, ".env")
    print(f"Uploading: {local_env} -> {remote_env}")
    sftp.put(local_env, remote_env)

    # Helper function to upload directories recursively
    def upload_dir(local_path, remote_path):
        try:
            sftp.mkdir(remote_path)
            print(f"Created remote directory: {remote_path}")
        except IOError:
            pass # Directory already exists
        
        for item in os.listdir(local_path):
            # Exclude folders we don't want
            if item in ["node_modules", ".env", ".git", "ios", "android", "__tests__", "__mocks__", "dist"]:
                continue
            
            l_item = os.path.join(local_path, item)
            r_item = os.path.join(remote_path, item)
            
            if os.path.isdir(l_item):
                upload_dir(l_item, r_item)
            else:
                print(f"Uploading file: {l_item} -> {r_item}")
                sftp.put(l_item, r_item)

    print("\nUploading server files...")
    upload_dir(os.path.join(local_project_root, "server"), os.path.join(remote_target_dir, "server"))
    
    sftp.close()

    # Build and start Docker containers
    print("\nPruning Docker cache, rebuilding and running Docker containers on the VPS...")
    cmd = f"cd {remote_target_dir} && sudo -S docker compose down && sudo -S docker builder prune -a -f && sudo -S docker compose up -d --build"
    run_sudo_cmd(ssh, cmd, password)

    print("\nVPS setup completed successfully!")
    ssh.close()

except Exception as e:
    print(f"\nAn error occurred: {e}")
    sys.exit(1)
