import { DataTypes, Model, Sequelize } from 'sequelize';
import { Session as SessionType } from '../../types';

export class Session extends Model<SessionType> implements SessionType {
  public id!: number;
  public mac!: string;
  public ip!: string;
  public username!: string;
  public sessionId!: string;
  public startTime!: Date;
  public updateTime!: Date;
  public endTime!: Date;
  public bytesIn!: number;
  public bytesOut!: number;
  public active!: boolean;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: Sequelize): void {
    Session.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        mac: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        ip: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        sessionId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        startTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updateTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        endTime: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        bytesIn: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0,
        },
        bytesOut: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0,
        },
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        tableName: 'sessions',
        indexes: [
          {
            name: 'sessions_mac_idx',
            fields: ['mac'],
          },
          {
            name: 'sessions_session_id_idx',
            fields: ['sessionId'],
          },
          {
            name: 'sessions_active_idx',
            fields: ['active'],
          },
        ],
      }
    );
  }
}