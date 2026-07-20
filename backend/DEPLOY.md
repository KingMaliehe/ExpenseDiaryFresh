# Self-hosting on an Azure VM (Docker Compose)

Everything runs on one VM you own: Postgres, the API, and Caddy (which
handles HTTPS automatically). All config lives in `deploy/`.

## 1. Get a domain (~R100–200/yr)

Any registrar works. For a `.co.za`: [domains.co.za](https://www.domains.co.za) or Afrihost.
For `.com`/`.xyz`/`.dev`: [Porkbun](https://porkbun.com) or Namecheap.
You'll create one DNS record in step 3 — nothing else is needed.

## 2. Create the VM

In the [Azure portal](https://portal.azure.com): **Create a resource → Virtual machine**.

- Region: **South Africa North** (Johannesburg)
- Image: **Ubuntu Server 24.04 LTS**
- Size: **B2s** (2 vCPU / 4 GB) — comfortable. Check the [pricing calculator](https://azure.microsoft.com/pricing/calculator/); B1s/B2ats are cheaper if budget matters.
- Authentication: SSH public key (Azure can generate one for you — download the .pem)
- Inbound ports: allow **22 (SSH), 80 (HTTP), 443 (HTTPS)**

After it's created, note the **public IP**. In the VM's settings, make the IP
**Static** (IP configuration → Static) so it survives restarts.

## 3. Point your domain at it

At your registrar, add an **A record**: `api` → `<your VM's public IP>`.
So `api.yourdomain.co.za` resolves to the VM. Give it a few minutes to propagate.

## 4. Set up the VM (once)

SSH in (`ssh -i key.pem azureuser@<ip>`), then:

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit   # log out/in for group to apply

# (ssh back in)
git clone https://github.com/<you>/<repo>.git app
cd app/backend/deploy
cp .env.example .env
nano .env    # fill in DOMAIN, POSTGRES_PASSWORD, JWT secrets, RESEND key
docker compose up -d --build
```

First start builds the image, creates the database, runs migrations, and
Caddy fetches a Let's Encrypt certificate for your domain.

Check: `https://api.yourdomain.co.za/health` → `{"ok":true,"db":"ok",...}`

## 5. Point the app at it

Repo root `.env` on your machine:

```
EXPO_PUBLIC_API_URL=https://api.yourdomain.co.za
```

Same value in EAS for builds:
`eas env:create --name EXPO_PUBLIC_API_URL --value https://api.yourdomain.co.za`

## Day-2 operations

**Deploy an update** (after pushing to GitHub):

```bash
cd ~/app && git pull && cd backend/deploy && docker compose up -d --build
```

**Backups** — nightly dump, keeps 14 days:

```bash
chmod +x ~/app/backend/deploy/backup.sh
crontab -e    # add:  0 2 * * * /home/azureuser/app/backend/deploy/backup.sh
```

Restore: `gunzip -c backups/expensediary-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U postgres expensediary`

**Logs**: `docker compose logs -f api` (OTP emails print here if no Resend key).

**OS security updates**: `sudo apt install unattended-upgrades` (usually pre-enabled on Ubuntu).

## Moving hosts later

The whole stack is this folder + a database dump. On any new server:
install Docker, clone, restore the dump, update the DNS A record. Done.
