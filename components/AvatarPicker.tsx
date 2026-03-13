import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { getRankInfo } from '../services/ranking';

export const AVATARS: Record<string, any> = {
  avatar_1: require('../assets/avatars/avatar_1.png'),
  avatar_2: require('../assets/avatars/avatar_2.png'),
  avatar_3: require('../assets/avatars/avatar_3.png'),
  avatar_4: require('../assets/avatars/avatar_4.png'),
  avatar_5: require('../assets/avatars/avatar_5.png'),
  avatar_6: require('../assets/avatars/avatar_6.png'),
  avatar_7: require('../assets/avatars/avatar_7.png'),
  avatar_8: require('../assets/avatars/avatar_8.png'),
};

export const AVATAR_LIST = Object.keys(AVATARS);

interface RankBadgeProps {
  rank: string;
  size?: 'small' | 'medium' | 'large';
}

export const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 'medium' }) => {
  const rankInfo = getRankInfo(rank);
  const fontSize = { small: 12, medium: 16, large: 22 }[size];

  return (
    <View style={[styles.badge, { borderColor: rankInfo.color }]}>
      <Text style={{ fontSize }}>{rankInfo.icon}</Text>
      <Text style={[styles.rankText, { color: rankInfo.color, fontSize: fontSize - 4 }]}>
        {rank}
      </Text>
    </View>
  );
};

import { TouchableOpacity, FlatList } from 'react-native';

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatar: string) => void;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ selected, onSelect }) => {
  return (
    <FlatList
      data={AVATAR_LIST}
      numColumns={4}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.avatarOption, selected === item && styles.avatarSelected]}
          onPress={() => onSelect(item)}
        >
          <Image source={AVATARS[item]} style={styles.avatarImage} />
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  rankText: {
    fontWeight: 'bold',
  },
  avatarOption: {
    margin: 6,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 2,
  },
  avatarSelected: {
    borderColor: COLORS.primary,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});

export default AvatarPicker;
